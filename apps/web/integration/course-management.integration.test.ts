import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  addCourseTopic,
  createCourseForUser,
  deleteCourseTopic,
  getCourseForUser,
  joinSharedCourse,
  recordStudyActivity,
  reorderCourseTopics,
  replaceCourseOutline,
  setTopicCompletion,
  setTopicConfidence,
  updateCourseTopicContext,
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

  it("persists a three-level ordered outline and protects every mutation", async () => {
    const courseId = await createCourseForUser(adminId, {
      name: "Outline Integration Course",
      description: "Three-level hierarchy coverage.",
      type: "independent",
      targetDate: null,
      topicOutline: "First topic\nSecond topic",
    });
    let course = await getCourseForUser(adminId, courseId);
    const firstTopic = course!.topics[0];
    const secondTopic = course!.topics[1];

    await reorderCourseTopics({
      courseId,
      orderedTopicIds: [secondTopic.id, firstTopic.id],
      userId: adminId,
    });
    await addCourseTopic({
      courseId,
      name: "First child",
      parentId: firstTopic.id,
      userId: adminId,
    });
    course = await getCourseForUser(adminId, courseId);
    const persistedFirst = course!.topics.find(
      (topic) => topic.id === firstTopic.id,
    )!;
    const firstChild = persistedFirst.subtopics[0];
    await addCourseTopic({
      courseId,
      name: "First grandchild",
      parentId: firstChild.id,
      userId: adminId,
    });
    await updateCourseTopicContext({
      context: "Grounding context for the child topic.",
      courseId,
      topicId: firstChild.id,
      userId: adminId,
    });

    course = await getCourseForUser(adminId, courseId);
    expect(course!.topics.map((topic) => topic.name)).toEqual([
      "Second topic",
      "First topic",
    ]);
    const updatedFirst = course!.topics[1];
    expect(updatedFirst.subtopics[0].description).toBe(
      "Grounding context for the child topic.",
    );
    expect(updatedFirst.subtopics[0].subtopics[0].name).toBe(
      "First grandchild",
    );

    await expect(
      addCourseTopic({
        courseId,
        name: "Unsupported fourth level",
        parentId: updatedFirst.subtopics[0].subtopics[0].id,
        userId: adminId,
      }),
    ).rejects.toThrow("at most three levels");
    await expect(
      reorderCourseTopics({
        courseId,
        orderedTopicIds: [firstTopic.id],
        userId: adminId,
      }),
    ).rejects.toThrow("complete sibling order");
    await expect(
      updateCourseTopicContext({
        context: "Forbidden",
        courseId,
        topicId: firstChild.id,
        userId: memberId,
      }),
    ).rejects.toThrow("Only course admins can edit topics.");

    await addCourseTopic({
      courseId,
      name: "Disposable topic",
      parentId: null,
      userId: adminId,
    });
    course = await getCourseForUser(adminId, courseId);
    const disposable = course!.topics.find(
      (topic) => topic.name === "Disposable topic",
    )!;
    await addCourseTopic({
      courseId,
      name: "Disposable child",
      parentId: disposable.id,
      userId: adminId,
    });
    await deleteCourseTopic({
      courseId,
      topicId: disposable.id,
      userId: adminId,
    });
    course = await getCourseForUser(adminId, courseId);
    expect(
      course!.topics.some((topic) => topic.name === "Disposable topic"),
    ).toBe(false);

    const replacement = [
      {
        name: "First topic",
        children: [
          {
            name: "First child",
            children: [{ name: "First grandchild", children: [] }],
          },
        ],
      },
      { name: "Chapter 2", children: [] },
    ];
    await expect(
      replaceCourseOutline({
        courseId,
        outline: replacement,
        userId: memberId,
      }),
    ).rejects.toThrow("Only course admins can edit topics.");
    await replaceCourseOutline({
      courseId,
      outline: replacement,
      userId: adminId,
    });

    course = await getCourseForUser(adminId, courseId);
    expect(course!.topics.map((topic) => topic.name)).toEqual([
      "First topic",
      "Chapter 2",
    ]);
    expect(course!.topics[0].subtopics[0].subtopics[0].name).toBe(
      "First grandchild",
    );
    expect(course!.topics[0].subtopics[0].description).toBe(
      "Grounding context for the child topic.",
    );
  });
});
