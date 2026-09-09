import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { courses, topics } from "./courses";

export const studySessionStatus = pgEnum("study_session_status", [
  "active",
  "completed",
  "abandoned",
]);
export const scheduleItemStatus = pgEnum("schedule_item_status", [
  "planned",
  "completed",
  "skipped",
]);

export const userTopicProgress = pgTable(
  "user_topic_progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    lastStudiedAt: timestamp("last_studied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.topicId] }),
    index("user_topic_progress_topic_id_idx").on(table.topicId),
  ],
);

export const userSelfAssessments = pgTable(
  "user_self_assessments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    note: text("note"),
    assessedAt: timestamp("assessed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_self_assessments_user_topic_idx").on(
      table.userId,
      table.topicId,
    ),
    index("user_self_assessments_topic_id_idx").on(table.topicId),
    check(
      "user_self_assessments_rating_range",
      sql`${table.rating} between 1 and 5`,
    ),
  ],
);

export const studySessions = pgTable(
  "study_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id").references(() => topics.id, {
      onDelete: "set null",
    }),
    status: studySessionStatus("status").notNull().default("active"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("study_sessions_user_course_idx").on(table.userId, table.courseId),
    check(
      "study_sessions_end_after_start",
      sql`${table.endedAt} is null or ${table.endedAt} >= ${table.startedAt}`,
    ),
  ],
);

export const assessmentEvidence = pgTable(
  "assessment_evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    studySessionId: uuid("study_session_id").references(
      () => studySessions.id,
      {
        onDelete: "set null",
      },
    ),
    evidenceType: text("evidence_type").notNull(),
    score: numeric("score"),
    maximumScore: numeric("maximum_score"),
    difficulty: numeric("difficulty"),
    hintsUsed: integer("hints_used"),
    responseTimeMs: integer("response_time_ms"),
    model: text("model"),
    promptVersion: text("prompt_version"),
    rawEvidence: jsonb("raw_evidence")
      .$type<Record<string, unknown>>()
      .notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("assessment_evidence_user_topic_idx").on(table.userId, table.topicId),
    index("assessment_evidence_session_id_idx").on(table.studySessionId),
    check(
      "assessment_evidence_hints_nonnegative",
      sql`${table.hintsUsed} is null or ${table.hintsUsed} >= 0`,
    ),
    check(
      "assessment_evidence_response_time_nonnegative",
      sql`${table.responseTimeMs} is null or ${table.responseTimeMs} >= 0`,
    ),
  ],
);

export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").references(() => courses.id, {
      onDelete: "cascade",
    }),
    topicId: uuid("topic_id").references(() => topics.id, {
      onDelete: "set null",
    }),
    studySessionId: uuid("study_session_id").references(
      () => studySessions.id,
      {
        onDelete: "set null",
      },
    ),
    eventType: text("event_type").notNull(),
    durationSeconds: integer("duration_seconds"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("activity_events_user_occurred_at_idx").on(
      table.userId,
      table.occurredAt,
    ),
    index("activity_events_course_id_idx").on(table.courseId),
    check(
      "activity_events_duration_nonnegative",
      sql`${table.durationSeconds} is null or ${table.durationSeconds} >= 0`,
    ),
  ],
);

export const userCourseSchedules = pgTable(
  "user_course_schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    targetDate: date("target_date").notNull(),
    weeklyTargetMinutes: integer("weekly_target_minutes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_course_schedules_user_course_idx").on(
      table.userId,
      table.courseId,
    ),
    check(
      "user_course_schedules_weekly_minutes_positive",
      sql`${table.weeklyTargetMinutes} is null or ${table.weeklyTargetMinutes} > 0`,
    ),
  ],
);

export const scheduleItems = pgTable(
  "schedule_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scheduleId: uuid("schedule_id")
      .notNull()
      .references(() => userCourseSchedules.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    plannedFor: date("planned_for").notNull(),
    estimatedMinutes: integer("estimated_minutes"),
    status: scheduleItemStatus("status").notNull().default("planned"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("schedule_items_schedule_date_idx").on(
      table.scheduleId,
      table.plannedFor,
    ),
    check(
      "schedule_items_estimated_minutes_positive",
      sql`${table.estimatedMinutes} is null or ${table.estimatedMinutes} > 0`,
    ),
  ],
);
