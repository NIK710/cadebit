import { readFileSync } from "node:fs";

import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  accounts,
  activityEvents,
  assessmentEvidence,
  courseAiConversations,
  courseAiMessages,
  courseMaterials,
  courseMemberships,
  courses,
  materials,
  materialChunks,
  materialIngestionJobs,
  practiceQuestions,
  scheduleItems,
  sessions,
  studySessions,
  topics,
  userCourseSchedules,
  users,
  userSelfAssessments,
  userTopicMastery,
  userTopicProgress,
  verifications,
} from ".";

describe("canonical database schema", () => {
  it("exports every Phase 2 table from the Drizzle schema", () => {
    const tableNames = [
      accounts,
      activityEvents,
      assessmentEvidence,
      courseAiConversations,
      courseAiMessages,
      courseMaterials,
      courseMemberships,
      courses,
      materials,
      materialChunks,
      materialIngestionJobs,
      practiceQuestions,
      scheduleItems,
      sessions,
      studySessions,
      topics,
      userCourseSchedules,
      users,
      userSelfAssessments,
      userTopicMastery,
      userTopicProgress,
      verifications,
    ].map(getTableName);

    expect(new Set(tableNames).size).toBe(22);
    expect(tableNames).toContain("users");
    expect(tableNames).toContain("course_memberships");
    expect(tableNames).toContain("assessment_evidence");
    expect(tableNames).toContain("activity_events");
    expect(tableNames).toContain("material_chunks");
    expect(tableNames).toContain("material_ingestion_jobs");
    expect(tableNames).toContain("practice_questions");
    expect(tableNames).toContain("user_topic_mastery");
    expect(tableNames).toContain("course_ai_conversations");
    expect(tableNames).toContain("course_ai_messages");
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

  it("enables pgvector before creating vector columns", () => {
    const migration = readFileSync(
      new URL(
        "../../../drizzle/0002_sour_captain_britain.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const extensionPosition = migration.indexOf(
      "CREATE EXTENSION IF NOT EXISTS vector",
    );
    const vectorColumnPosition = migration.indexOf('"embedding" vector(1536)');

    expect(extensionPosition).toBeGreaterThan(-1);
    expect(vectorColumnPosition).toBeGreaterThan(extensionPosition);
  });
});
