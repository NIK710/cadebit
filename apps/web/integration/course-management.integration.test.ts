import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  addCourseTopic,
  createCourseForUser,
  getCourseForUser,
  joinSharedCourse,
  recordStudyActivity,
  setTopicCompletion,
  setTopicConfidence,
  updateTargetDate,
} from "../lib/db/course-management";
import { db, pool } from "../lib/db";
import { courses, users } from "../lib/db/schema";

const testId = crypto.randomUUID();
const adminId = `phase3-admin-${testId}`;
const memberId = `phase3-member-${testId}`;

beforeAll(async () => {
  await db.insert(users).values([
    {
      id: adminId,
      name: "Phase 3 Admin",
      email: `phase3-admin-${testId}@cadebit.test`,
    },
    {
      id: memberId,
      name: "Phase 3 Member",
      email: `phase3-member-${testId}@cadebit.test`,
    },
  ]);
});

afterAll(async () => {
  await db.delete(courses).where(eq(courses.ownerId, adminId));
  await db.delete(users).where(inArray(users.id, [adminId, memberId]));
  await pool.end();
});

describe("database-backed course management", () => {
  it("enforces structure permissions and keeps learning state per user", async () => {
    const courseId = await createCourseForUser(adminId, {
      name: "Shared Integration Course",
      description: "Permission and learning-state coverage.",
      type: "shared",
      targetDate: "2026-12-01",
      topicOutline: "Foundations > Definitions",
    });

    const adminCourse = await getCourseForUser(adminId, courseId);
    expect(adminCourse?.joinCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(adminCourse?.role).toBe("admin");

    await joinSharedCourse(memberId, adminCourse!.joinCode!);
    const memberCourse = await getCourseForUser(memberId, courseId);
    expect(memberCourse?.role).toBe("member");
    expect(memberCourse?.joinCode).toBeNull();
    expect(memberCourse?.topics[0].name).toBe("Foundations");

    await expect(
      addCourseTopic({
        courseId,
        name: "Forbidden member topic",
        parentId: null,
        userId: memberId,
      }),
    ).rejects.toThrow("Only course admins can edit topics.");

    await addCourseTopic({
      courseId,
      name: "Admin topic",
      parentId: null,
      userId: adminId,
    });

    const topicId = memberCourse!.topics[0].id;
    await setTopicCompletion({
      courseId,
      topicId,
      completed: true,
      userId: memberId,
    });
    await setTopicConfidence({
      courseId,
      topicId,
      rating: 4,
      userId: memberId,
    });
    await updateTargetDate({
      courseId,
      targetDate: "2026-11-15",
      userId: memberId,
    });
    await recordStudyActivity({
      courseId,
      durationMinutes: 25,
      userId: memberId,
    });

    const updatedMemberCourse = await getCourseForUser(memberId, courseId);
    const unchangedAdminCourse = await getCourseForUser(adminId, courseId);
    expect(updatedMemberCourse?.targetDate).toBe("2026-11-15");
    expect(updatedMemberCourse?.topics[0].completed).toBe(true);
    expect(updatedMemberCourse?.topics[0].confidence).toBe(4);
    expect(updatedMemberCourse?.totalStudySeconds).toBe(1_500);
    expect(unchangedAdminCourse?.targetDate).toBe("2026-12-01");
    expect(unchangedAdminCourse?.topics[0].completed).toBe(false);
    expect(unchangedAdminCourse?.topics[0].confidence).toBeNull();
    expect(unchangedAdminCourse?.totalStudySeconds).toBe(0);
  });

  it("keeps independent courses private and without join codes", async () => {
    const courseId = await createCourseForUser(adminId, {
      name: "Private Integration Course",
      description: "Only the owner can access this course.",
      type: "independent",
      targetDate: null,
      topicOutline: "Private topic",
    });

    const ownerCourse = await getCourseForUser(adminId, courseId);
    expect(ownerCourse?.joinCode).toBeNull();
    expect(await getCourseForUser(memberId, courseId)).toBeNull();
  });
});
