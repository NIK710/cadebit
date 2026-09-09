export type CourseMembership = {
  userId: string;
  role: "admin" | "member";
};

export type CourseAction =
  "view" | "manage_structure" | "manage_members" | "update_learning_state";

export function isCourseActionAllowed({
  action,
  actorUserId,
  membership,
  targetUserId,
}: {
  action: CourseAction;
  actorUserId: string;
  membership: CourseMembership | null;
  targetUserId?: string;
}): boolean {
  if (!membership || membership.userId !== actorUserId) return false;

  if (action === "view") return true;
  if (action === "manage_structure" || action === "manage_members") {
    return membership.role === "admin";
  }

  return targetUserId === actorUserId;
}
