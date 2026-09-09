import { readFileSync } from "node:fs";

import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  accounts,
  activityEvents,
  assessmentEvidence,
  courseMaterials,
  courseMemberships,
  courses,
  materials,
  scheduleItems,
  sessions,
  studySessions,
  topics,
  userCourseSchedules,
  users,
  userSelfAssessments,
  userTopicProgress,
  verifications,
} from ".";

describe("canonical database schema", () => {
  it("exports every Phase 2 table from the Drizzle schema", () => {
    const tableNames = [
      accounts,
      activityEvents,
      assessmentEvidence,
      courseMaterials,
      courseMemberships,
      courses,
      materials,
      scheduleItems,
      sessions,
      studySessions,
      topics,
      userCourseSchedules,
      users,
      userSelfAssessments,
      userTopicProgress,
      verifications,
    ].map(getTableName);

    expect(new Set(tableNames).size).toBe(16);
    expect(tableNames).toContain("users");
    expect(tableNames).toContain("course_memberships");
    expect(tableNames).toContain("assessment_evidence");
    expect(tableNames).toContain("activity_events");
  });

  it("creates the topics composite unique index before its self-reference", () => {
    const migration = readFileSync(
      new URL("../../../drizzle/0000_fresh_fallen_one.sql", import.meta.url),
      "utf8",
    );
    const uniqueIndexPosition = migration.indexOf(
      'CREATE UNIQUE INDEX "topics_id_course_id_idx"',
    );
    const foreignKeyPosition = migration.indexOf(
      'ADD CONSTRAINT "topics_parent_same_course_fk"',
    );

    expect(uniqueIndexPosition).toBeGreaterThan(-1);
    expect(foreignKeyPosition).toBeGreaterThan(uniqueIndexPosition);
  });
});
