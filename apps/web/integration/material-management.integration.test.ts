import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createCourseForUser,
  joinSharedCourse,
} from "../lib/db/course-management";
import {
  createMaterialRecords,
  listCourseMaterialsForUser,
  MaterialManagementError,
  removeMaterialFromCourse,
} from "../lib/db/material-management";
import { db, pool } from "../lib/db";
import { courseMaterials, courses, materials, users } from "../lib/db/schema";

const testId = crypto.randomUUID();
const adminId = `material-admin-${testId}`;
const memberId = `material-member-${testId}`;
const outsiderId = `material-outsider-${testId}`;
const materialIds: string[] = [];

beforeAll(async () => {
  await db.insert(users).values([
    { id: adminId, name: "Material Admin", email: `${adminId}@cadebit.test` },
    {
      id: memberId,
      name: "Material Member",
      email: `${memberId}@cadebit.test`,
    },
    {
      id: outsiderId,
      name: "Material Outsider",
      email: `${outsiderId}@cadebit.test`,
    },
  ]);
});

afterAll(async () => {
  if (materialIds.length) {
    await db.delete(materials).where(inArray(materials.id, materialIds));
  }
  await db.delete(courses).where(eq(courses.ownerId, adminId));
  await db
    .delete(users)
    .where(inArray(users.id, [adminId, memberId, outsiderId]));
  await pool.end();
});

describe("course material authorization", () => {
  it("isolates material visibility by course and limits uploads to admins", async () => {
    const firstCourseId = await createCourseForUser(adminId, {
      name: "First material course",
      description: "Cross-course isolation A",
      type: "shared",
      targetDate: null,
      outline: [{ name: "Topic A", children: [] }],
    });
    const secondCourseId = await createCourseForUser(adminId, {
      name: "Second material course",
      description: "Cross-course isolation B",
      type: "independent",
      targetDate: null,
      outline: [{ name: "Topic B", children: [] }],
    });
    const [firstCourse] = await db
      .select({ joinCode: courses.joinCode })
      .from(courses)
      .where(eq(courses.id, firstCourseId));
    await joinSharedCourse(memberId, firstCourse.joinCode!);

    const materialId = crypto.randomUUID();
    materialIds.push(materialId);
    await createMaterialRecords({
      byteSize: 12,
      contentHash: "a".repeat(64),
      courseId: firstCourseId,
      filename: "notes.txt",
      materialId,
      mediaType: "text/plain",
      pipelineVersion: "test-v1",
      storageKey: `tests/${materialId}`,
      title: "Course A notes",
      userId: adminId,
    });

    expect(
      await listCourseMaterialsForUser(memberId, firstCourseId),
    ).toHaveLength(1);
    expect(await listCourseMaterialsForUser(adminId, secondCourseId)).toEqual(
      [],
    );
    expect(await listCourseMaterialsForUser(outsiderId, firstCourseId)).toEqual(
      [],
    );

    await db
      .update(materials)
      .set({
        status: "failed",
        failureReason:
          '{"error":{"code":"insufficient_quota","message":"provider account details"}}',
      })
      .where(eq(materials.id, materialId));
    const [failedSummary] = await listCourseMaterialsForUser(
      adminId,
      firstCourseId,
    );
    expect(failedSummary.status).toBe("failed");
    expect(failedSummary).not.toHaveProperty("failureReason");

    await expect(
      createMaterialRecords({
        byteSize: 12,
        contentHash: "b".repeat(64),
        courseId: firstCourseId,
        filename: "forbidden.txt",
        materialId: crypto.randomUUID(),
        mediaType: "text/plain",
        pipelineVersion: "test-v1",
        storageKey: `tests/forbidden-${testId}`,
        title: "Forbidden member upload",
        userId: memberId,
      }),
    ).rejects.toBeInstanceOf(MaterialManagementError);

    const deletedObjects: string[] = [];
    const deleteObject = async (key: string) => {
      deletedObjects.push(key);
    };
    await db.insert(courseMaterials).values({
      courseId: secondCourseId,
      materialId,
      attachedByUserId: adminId,
    });

    await expect(
      removeMaterialFromCourse(
        { courseId: firstCourseId, materialId, userId: memberId },
        deleteObject,
      ),
    ).rejects.toThrow("Only course admins can remove course materials.");

    await removeMaterialFromCourse(
      { courseId: firstCourseId, materialId, userId: adminId },
      deleteObject,
    );
    expect(await listCourseMaterialsForUser(adminId, firstCourseId)).toEqual(
      [],
    );
    expect(
      await listCourseMaterialsForUser(adminId, secondCourseId),
    ).toHaveLength(1);
    expect(deletedObjects).toEqual([]);

    await removeMaterialFromCourse(
      { courseId: secondCourseId, materialId, userId: adminId },
      deleteObject,
    );
    expect(await listCourseMaterialsForUser(adminId, secondCourseId)).toEqual(
      [],
    );
    expect(deletedObjects).toEqual([`tests/${materialId}`]);
    expect(
      await db
        .select({ id: materials.id })
        .from(materials)
        .where(eq(materials.id, materialId)),
    ).toEqual([]);
  });
});
