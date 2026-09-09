import "server-only";

import { and, eq } from "drizzle-orm";

import { isCourseActionAllowed, type CourseAction } from "../authorization";
import { db } from ".";
import { courseMemberships } from "./schema";

export async function canUserPerformCourseAction({
  action,
  courseId,
  targetUserId,
  userId,
}: {
  action: CourseAction;
  courseId: string;
  targetUserId?: string;
  userId: string;
}): Promise<boolean> {
  const [membership] = await db
    .select({ userId: courseMemberships.userId, role: courseMemberships.role })
    .from(courseMemberships)
    .where(
      and(
        eq(courseMemberships.courseId, courseId),
        eq(courseMemberships.userId, userId),
      ),
    )
    .limit(1);

  return isCourseActionAllowed({
    action,
    actorUserId: userId,
    membership: membership ?? null,
    targetUserId,
  });
}
