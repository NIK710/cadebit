import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { SourceReference, TokenUsage } from "../../ai-service";
import { courseMemberships } from "./courses";

export const courseAiMessageRole = pgEnum("course_ai_message_role", [
  "user",
  "assistant",
]);
export const courseAiGroundingStatus = pgEnum("course_ai_grounding_status", [
  "grounded",
  "insufficient",
]);

export const courseAiConversations = pgTable(
  "course_ai_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id").notNull(),
    userId: text("user_id").notNull(),
    revision: integer("revision").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.courseId, table.userId],
      foreignColumns: [courseMemberships.courseId, courseMemberships.userId],
      name: "course_ai_conversations_membership_fk",
    }).onDelete("cascade"),
    uniqueIndex("course_ai_conversations_user_course_idx").on(
      table.userId,
      table.courseId,
    ),
    check(
      "course_ai_conversations_revision_nonnegative",
      sql`${table.revision} >= 0`,
    ),
  ],
);

export const courseAiMessages = pgTable(
  "course_ai_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => courseAiConversations.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    role: courseAiMessageRole("role").notNull(),
    content: text("content").notNull(),
    groundingStatus: courseAiGroundingStatus("grounding_status"),
    sourceReferences: jsonb("source_references")
      .$type<SourceReference[]>()
      .notNull()
      .default([]),
    model: text("model"),
    promptVersion: text("prompt_version"),
    generationRequestId: text("generation_request_id"),
    generationResponseId: text("generation_response_id"),
    usage: jsonb("usage").$type<TokenUsage>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("course_ai_messages_conversation_position_idx").on(
      table.conversationId,
      table.position,
    ),
    index("course_ai_messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
    check(
      "course_ai_messages_position_nonnegative",
      sql`${table.position} >= 0`,
    ),
    check(
      "course_ai_messages_content_not_blank",
      sql`length(trim(${table.content})) > 0`,
    ),
    check(
      "course_ai_messages_role_metadata",
      sql`(${table.role} = 'user' and ${table.groundingStatus} is null) or (${table.role} = 'assistant' and ${table.groundingStatus} is not null)`,
    ),
  ],
);
