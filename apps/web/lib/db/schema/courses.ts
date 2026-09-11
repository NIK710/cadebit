import { sql } from "drizzle-orm";
import {
  char,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

export const courseType = pgEnum("course_type", ["shared", "independent"]);
export const membershipRole = pgEnum("membership_role", ["admin", "member"]);
export const materialStatus = pgEnum("material_status", [
  "uploaded",
  "processing",
  "ready",
  "failed",
]);
export const materialIngestionStatus = pgEnum("material_ingestion_status", [
  "pending",
  "processing",
  "retry",
  "complete",
  "failed",
]);

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    type: courseType("type").notNull(),
    joinCode: char("join_code", { length: 6 }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("courses_owner_id_idx").on(table.ownerId),
    uniqueIndex("courses_join_code_idx").on(table.joinCode),
    check("courses_name_not_blank", sql`length(trim(${table.name})) > 0`),
    check(
      "courses_join_code_matches_type",
      sql`(${table.type} = 'shared' and ${table.joinCode} ~ '^[A-HJ-NP-Z2-9]{6}$') or (${table.type} = 'independent' and ${table.joinCode} is null)`,
    ),
  ],
);

export const courseMemberships = pgTable(
  "course_memberships",
  {
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: membershipRole("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.courseId, table.userId] }),
    index("course_memberships_user_id_idx").on(table.userId),
  ],
);

export const topics = pgTable(
  "topics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("topics_course_id_idx").on(table.courseId),
    index("topics_parent_id_idx").on(table.parentId),
    uniqueIndex("topics_id_course_id_idx").on(table.id, table.courseId),
    uniqueIndex("topics_course_parent_position_idx").on(
      table.courseId,
      table.parentId,
      table.position,
    ),
    check("topics_name_not_blank", sql`length(trim(${table.name})) > 0`),
    check(
      "topics_not_self_parent",
      sql`${table.parentId} is null or ${table.parentId} <> ${table.id}`,
    ),
    foreignKey({
      columns: [table.parentId, table.courseId],
      foreignColumns: [table.id, table.courseId],
      name: "topics_parent_same_course_fk",
    }).onDelete("cascade"),
  ],
);

export const materials = pgTable(
  "materials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    originalFilename: text("original_filename").notNull(),
    mediaType: text("media_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    contentHash: char("content_hash", { length: 64 }),
    storageKey: text("storage_key").notNull().unique(),
    status: materialStatus("status").notNull().default("uploaded"),
    failureReason: text("failure_reason"),
    pipelineVersion: text("pipeline_version"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    sourceMetadata: jsonb("source_metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("materials_owner_id_idx").on(table.ownerId),
    check("materials_byte_size_nonnegative", sql`${table.byteSize} >= 0`),
  ],
);

export const materialChunks = pgTable(
  "material_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    content: text("content").notNull(),
    contentHash: char("content_hash", { length: 64 }).notNull(),
    pageNumber: integer("page_number"),
    section: text("section"),
    sourceMetadata: jsonb("source_metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    pipelineVersion: text("pipeline_version").notNull(),
    embeddingModel: text("embedding_model").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("material_chunks_material_pipeline_position_idx").on(
      table.materialId,
      table.pipelineVersion,
      table.position,
    ),
    index("material_chunks_material_id_idx").on(table.materialId),
    index("material_chunks_embedding_hnsw_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
    check("material_chunks_position_nonnegative", sql`${table.position} >= 0`),
    check(
      "material_chunks_page_number_positive",
      sql`${table.pageNumber} is null or ${table.pageNumber} > 0`,
    ),
    check(
      "material_chunks_content_not_blank",
      sql`length(trim(${table.content})) > 0`,
    ),
  ],
);

export const materialIngestionJobs = pgTable(
  "material_ingestion_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    pipelineVersion: text("pipeline_version").notNull(),
    status: materialIngestionStatus("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    availableAt: timestamp("available_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    lastError: text("last_error"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("material_ingestion_jobs_material_pipeline_idx").on(
      table.materialId,
      table.pipelineVersion,
    ),
    index("material_ingestion_jobs_claim_idx").on(
      table.status,
      table.availableAt,
    ),
    check(
      "material_ingestion_jobs_attempts_nonnegative",
      sql`${table.attempts} >= 0`,
    ),
    check(
      "material_ingestion_jobs_max_attempts_positive",
      sql`${table.maxAttempts} > 0`,
    ),
    check(
      "material_ingestion_jobs_attempts_bounded",
      sql`${table.attempts} <= ${table.maxAttempts}`,
    ),
  ],
);

export const courseMaterials = pgTable(
  "course_materials",
  {
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    attachedByUserId: text("attached_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    attachedAt: timestamp("attached_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.courseId, table.materialId] }),
    index("course_materials_material_id_idx").on(table.materialId),
  ],
);
