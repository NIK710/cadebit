import { describe, expect, it } from "vitest";

import { isCourseActionAllowed, type CourseMembership } from "./authorization";

const member: CourseMembership = { userId: "user-1", role: "member" };
const admin: CourseMembership = { userId: "user-1", role: "admin" };

describe("course authorization", () => {
  it("denies users without a membership", () => {
    expect(
      isCourseActionAllowed({
        action: "view",
        actorUserId: "user-1",
        membership: null,
      }),
    ).toBe(false);
  });

  it("allows members to view the shared course", () => {
    expect(
      isCourseActionAllowed({
        action: "view",
        actorUserId: "user-1",
        membership: member,
      }),
    ).toBe(true);
  });

  it("only allows admins to modify canonical course structure", () => {
    expect(
      isCourseActionAllowed({
        action: "manage_structure",
        actorUserId: "user-1",
        membership: member,
      }),
    ).toBe(false);
    expect(
      isCourseActionAllowed({
        action: "manage_structure",
        actorUserId: "user-1",
        membership: admin,
      }),
    ).toBe(true);
  });

  it("prevents users from modifying another user's learning state", () => {
    expect(
      isCourseActionAllowed({
        action: "update_learning_state",
        actorUserId: "user-1",
        membership: admin,
        targetUserId: "user-2",
      }),
    ).toBe(false);
    expect(
      isCourseActionAllowed({
        action: "update_learning_state",
        actorUserId: "user-1",
        membership: member,
        targetUserId: "user-1",
      }),
    ).toBe(true);
  });
});
