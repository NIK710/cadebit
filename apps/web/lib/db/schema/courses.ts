import { sql } from "drizzle-orm";
import {
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

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    type: courseType("type").notNull(),
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
    check("courses_name_not_blank", sql`length(trim(${table.name})) > 0`),
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
    storageKey: text("storage_key").notNull().unique(),
    status: materialStatus("status").notNull().default("uploaded"),
    failureReason: text("failure_reason"),
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
