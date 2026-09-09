import "server-only";

import { randomInt } from "node:crypto";

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  calculateProgress,
  normalizeJoinCode,
  parseTopicOutline,
  type CourseDetail,
  type CourseListItem,
  type CourseTopic,
} from "../courses";
import { db } from ".";
import {
  activityEvents,
  courseMemberships,
  courses,
  topics,
  userCourseSchedules,
  userSelfAssessments,
  userTopicProgress,
} from "./schema";

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class CourseManagementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CourseManagementError";
  }
}

export type CreateCourseInput = {
  name: string;
  description: string;
  type: "shared" | "independent";
  targetDate: string | null;
  topicOutline: string;
};

export function generateJoinCode(): string {
  return Array.from(
    { length: 6 },
    () => JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)],
  ).join("");
}

export async function listCoursesForUser(
  userId: string,
): Promise<CourseListItem[]> {
  const membershipRows = await db
    .select({
      id: courses.id,
      name: courses.name,
      description: courses.description,
      type: courses.type,
      role: courseMemberships.role,
      targetDate: userCourseSchedules.targetDate,
    })
    .from(courseMemberships)
    .innerJoin(courses, eq(courseMemberships.courseId, courses.id))
    .leftJoin(
      userCourseSchedules,
      and(
        eq(userCourseSchedules.courseId, courses.id),
        eq(userCourseSchedules.userId, userId),
      ),
    )
    .where(eq(courseMemberships.userId, userId))
    .orderBy(desc(courses.updatedAt));

  if (membershipRows.length === 0) return [];

  const progressRows = await db
    .select({
      courseId: topics.courseId,
      topicId: topics.id,
      completedAt: userTopicProgress.completedAt,
    })
    .from(topics)
    .leftJoin(
      userTopicProgress,
      and(
        eq(userTopicProgress.topicId, topics.id),
        eq(userTopicProgress.userId, userId),
      ),
    )
    .where(
      inArray(
        topics.courseId,
        membershipRows.map((course) => course.id),
      ),
    );

  return membershipRows.map((course) => {
    const courseProgress = progressRows.filter(
      (row) => row.courseId === course.id,
    );
    const completedTopics = courseProgress.filter(
      (row) => row.completedAt !== null,
    ).length;

    return {
      ...course,
      targetDate: course.targetDate ?? null,
      completedTopics,
      topicCount: courseProgress.length,
      progress: calculateProgress(completedTopics, courseProgress.length),
    };
  });
}

export async function getCourseForUser(
  userId: string,
  courseId: string,
): Promise<CourseDetail | null> {
  const [course] = await db
    .select({
      id: courses.id,
      name: courses.name,
      description: courses.description,
      type: courses.type,
      joinCode: courses.joinCode,
      role: courseMemberships.role,
      targetDate: userCourseSchedules.targetDate,
    })
    .from(courseMemberships)
    .innerJoin(courses, eq(courseMemberships.courseId, courses.id))
    .leftJoin(
      userCourseSchedules,
      and(
        eq(userCourseSchedules.courseId, courses.id),
        eq(userCourseSchedules.userId, userId),
      ),
    )
    .where(
      and(
        eq(courseMemberships.courseId, courseId),
        eq(courseMemberships.userId, userId),
      ),
    )
    .limit(1);

  if (!course) return null;

  const topicRows = await db
    .select({
      id: topics.id,
      parentId: topics.parentId,
      name: topics.name,
      description: topics.description,
      position: topics.position,
      completedAt: userTopicProgress.completedAt,
      confidence: userSelfAssessments.rating,
    })
    .from(topics)
    .leftJoin(
      userTopicProgress,
      and(
        eq(userTopicProgress.topicId, topics.id),
        eq(userTopicProgress.userId, userId),
      ),
    )
    .leftJoin(
      userSelfAssessments,
      and(
        eq(userSelfAssessments.topicId, topics.id),
        eq(userSelfAssessments.userId, userId),
      ),
    )
    .where(eq(topics.courseId, courseId))
    .orderBy(asc(topics.position), asc(topics.createdAt));

  const [activity] = await db
    .select({
      totalStudySeconds: sql<number>`coalesce(sum(${activityEvents.durationSeconds}), 0)`,
    })
    .from(activityEvents)
    .where(
      and(
        eq(activityEvents.courseId, courseId),
        eq(activityEvents.userId, userId),
      ),
    );

  const topicById = new Map<string, CourseTopic>();
  for (const row of topicRows) {
    topicById.set(row.id, {
      id: row.id,
      name: row.name,
      description: row.description,
      position: row.position,
      completed: row.completedAt !== null,
      confidence: row.confidence,
      subtopics: [],
    });
  }

  const rootTopics: CourseTopic[] = [];
  for (const row of topicRows) {
    const topic = topicById.get(row.id)!;
    const parent = row.parentId ? topicById.get(row.parentId) : null;
    if (parent) parent.subtopics.push(topic);
    else rootTopics.push(topic);
  }

  const completedTopics = topicRows.filter(
    (row) => row.completedAt !== null,
  ).length;

  return {
    ...course,
    joinCode: course.role === "admin" ? course.joinCode : null,
    targetDate: course.targetDate ?? null,
    completedTopics,
    topicCount: topicRows.length,
    progress: calculateProgress(completedTopics, topicRows.length),
    topics: rootTopics,
    totalStudySeconds: Number(activity?.totalStudySeconds ?? 0),
  };
}

export async function createCourseForUser(
  userId: string,
  input: CreateCourseInput,
): Promise<string> {
  const attempts = input.type === "shared" ? 5 : 1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const joinCode = input.type === "shared" ? generateJoinCode() : null;
    try {
      return await db.transaction(async (tx) => {
        const [course] = await tx
          .insert(courses)
          .values({
            name: input.name,
            description: input.description,
            type: input.type,
            joinCode,
            ownerId: userId,
          })
          .returning({ id: courses.id });

        await tx.insert(courseMemberships).values({
          courseId: course.id,
          userId,
          role: "admin",
        });

        if (input.targetDate) {
          await tx.insert(userCourseSchedules).values({
            courseId: course.id,
            userId,
            targetDate: input.targetDate,
          });
        }

        const outline = parseTopicOutline(input.topicOutline);
        for (const [topicPosition, outlineTopic] of outline.entries()) {
          const [parent] = await tx
            .insert(topics)
            .values({
              courseId: course.id,
              name: outlineTopic.name,
              position: topicPosition,
            })
            .returning({ id: topics.id });

          if (outlineTopic.subtopics.length) {
            await tx.insert(topics).values(
              outlineTopic.subtopics.map((name, position) => ({
                courseId: course.id,
                parentId: parent.id,
                name,
                position,
              })),
            );
          }
        }

        return course.id;
      });
    } catch (error) {
      if (isJoinCodeCollision(error) && attempt < attempts - 1) continue;
      throw error;
    }
  }

  throw new CourseManagementError("Could not generate a unique join code.");
}

export async function joinSharedCourse(
  userId: string,
  rawJoinCode: string,
): Promise<string> {
  const joinCode = normalizeJoinCode(rawJoinCode);
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.type, "shared"), eq(courses.joinCode, joinCode)))
    .limit(1);

  if (!course)
    throw new CourseManagementError("No shared course uses that code.");

  await db
    .insert(courseMemberships)
    .values({ courseId: course.id, userId, role: "member" })
    .onConflictDoNothing();

  return course.id;
}

export async function addCourseTopic({
  courseId,
  name,
  parentId,
  userId,
}: {
  courseId: string;
  name: string;
  parentId: string | null;
  userId: string;
}): Promise<void> {
  await db.transaction(async (tx) => {
    await requireAdmin(tx, userId, courseId);

    if (parentId) {
      const [parent] = await tx
        .select({ id: topics.id })
        .from(topics)
        .where(
          and(
            eq(topics.id, parentId),
            eq(topics.courseId, courseId),
            isNull(topics.parentId),
          ),
        )
        .limit(1);
      if (!parent) throw new CourseManagementError("Parent topic not found.");
    }

    const [positionRow] = await tx
      .select({ next: sql<number>`coalesce(max(${topics.position}), -1) + 1` })
      .from(topics)
      .where(
        and(
          eq(topics.courseId, courseId),
          parentId ? eq(topics.parentId, parentId) : isNull(topics.parentId),
        ),
      );

    await tx.insert(topics).values({
      courseId,
      parentId,
      name,
      position: Number(positionRow?.next ?? 0),
    });
  });
}

export async function renameCourseTopic({
  courseId,
  name,
  topicId,
  userId,
}: {
  courseId: string;
  name: string;
  topicId: string;
  userId: string;
}): Promise<void> {
  await db.transaction(async (tx) => {
    await requireAdmin(tx, userId, courseId);
    const updated = await tx
      .update(topics)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(topics.id, topicId), eq(topics.courseId, courseId)))
      .returning({ id: topics.id });
    if (!updated.length) throw new CourseManagementError("Topic not found.");
  });
}

export async function deleteCourseTopic({
  courseId,
  topicId,
  userId,
}: {
  courseId: string;
  topicId: string;
  userId: string;
}): Promise<void> {
  await db.transaction(async (tx) => {
    await requireAdmin(tx, userId, courseId);
    const deleted = await tx
      .delete(topics)
      .where(and(eq(topics.id, topicId), eq(topics.courseId, courseId)))
      .returning({ id: topics.id });
    if (!deleted.length) throw new CourseManagementError("Topic not found.");
  });
}

export async function updateTargetDate({
  courseId,
  targetDate,
  userId,
}: {
  courseId: string;
  targetDate: string | null;
  userId: string;
}): Promise<void> {
  await requireMember(userId, courseId);

  if (!targetDate) {
    await db
      .delete(userCourseSchedules)
      .where(
        and(
          eq(userCourseSchedules.courseId, courseId),
          eq(userCourseSchedules.userId, userId),
        ),
      );
    return;
  }

  await db
    .insert(userCourseSchedules)
    .values({ courseId, userId, targetDate })
    .onConflictDoUpdate({
      target: [userCourseSchedules.userId, userCourseSchedules.courseId],
      set: { targetDate, updatedAt: new Date() },
    });
}

export async function setTopicCompletion({
  completed,
  courseId,
  topicId,
  userId,
}: {
  completed: boolean;
  courseId: string;
  topicId: string;
  userId: string;
}): Promise<void> {
  await requireMemberAndTopic(userId, courseId, topicId);
  const completedAt = completed ? new Date() : null;
  await db
    .insert(userTopicProgress)
    .values({ userId, topicId, completedAt })
    .onConflictDoUpdate({
      target: [userTopicProgress.userId, userTopicProgress.topicId],
      set: { completedAt, updatedAt: new Date() },
    });
}

export async function setTopicConfidence({
  courseId,
  rating,
  topicId,
  userId,
}: {
  courseId: string;
  rating: number;
  topicId: string;
  userId: string;
}): Promise<void> {
  await requireMemberAndTopic(userId, courseId, topicId);
  await db
    .insert(userSelfAssessments)
    .values({ userId, topicId, rating })
    .onConflictDoUpdate({
      target: [userSelfAssessments.userId, userSelfAssessments.topicId],
      set: { rating, assessedAt: new Date() },
    });
}

export async function recordStudyActivity({
  courseId,
  durationMinutes,
  userId,
}: {
  courseId: string;
  durationMinutes: number;
  userId: string;
}): Promise<void> {
  await requireMember(userId, courseId);
  await db.insert(activityEvents).values({
    userId,
    courseId,
    eventType: "manual_study",
    durationSeconds: durationMinutes * 60,
  });
}

async function requireMember(userId: string, courseId: string): Promise<void> {
  const [membership] = await db
    .select({ userId: courseMemberships.userId })
    .from(courseMemberships)
    .where(
      and(
        eq(courseMemberships.courseId, courseId),
        eq(courseMemberships.userId, userId),
      ),
    )
    .limit(1);
  if (!membership) throw new CourseManagementError("Course not found.");
}

async function requireMemberAndTopic(
  userId: string,
  courseId: string,
  topicId: string,
): Promise<void> {
  const [row] = await db
    .select({ topicId: topics.id })
    .from(courseMemberships)
    .innerJoin(
      topics,
      and(
        eq(topics.courseId, courseMemberships.courseId),
        eq(topics.id, topicId),
      ),
    )
    .where(
      and(
        eq(courseMemberships.courseId, courseId),
        eq(courseMemberships.userId, userId),
      ),
    )
    .limit(1);
  if (!row) throw new CourseManagementError("Topic not found.");
}

async function requireAdmin(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  courseId: string,
): Promise<void> {
  const [membership] = await tx
    .select({ role: courseMemberships.role })
    .from(courseMemberships)
    .where(
      and(
        eq(courseMemberships.courseId, courseId),
        eq(courseMemberships.userId, userId),
      ),
    )
    .limit(1);
  if (membership?.role !== "admin") {
    throw new CourseManagementError("Only course admins can edit topics.");
  }
}

function isJoinCodeCollision(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    error.constraint === "courses_join_code_idx"
  );
}
