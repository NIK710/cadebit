import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";

import { serverEnvironment } from "../environment";
import { deletePrivateObject, putPrivateObject } from "../object-storage";
import { db } from ".";
import {
  courseMaterials,
  courseMemberships,
  materialIngestionJobs,
  materials,
} from "./schema";

export const MAX_MATERIAL_BYTES = 20 * 1024 * 1024;
export const SUPPORTED_MATERIAL_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
]);

export type CourseMaterialSummary = {
  id: string;
  title: string;
  originalFilename: string;
  mediaType: string;
  byteSize: number;
  status: "uploaded" | "processing" | "ready" | "failed";
  failureReason: string | null;
  createdAt: string;
};

export class MaterialManagementError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "MaterialManagementError";
  }
}

export async function uploadMaterialForCourse({
  bytes,
  courseId,
  filename,
  mediaType,
  title,
  userId,
}: {
  bytes: Uint8Array;
  courseId: string;
  filename: string;
  mediaType: string;
  title: string;
  userId: string;
}): Promise<string> {
  await requireCourseAdmin(userId, courseId);

  const materialId = randomUUID();
  const safeFilename = filename.replace(/[^A-Za-z0-9._-]/g, "_").slice(-180);
  const storageKey = `materials/${materialId}/${safeFilename || "material"}`;
  const contentHash = createHash("sha256").update(bytes).digest("hex");

  try {
    await putPrivateObject({
      body: bytes,
      contentType: mediaType,
      key: storageKey,
    });
  } catch (error) {
    throw new MaterialManagementError(
      "The material could not be stored. Please try again.",
      { cause: error },
    );
  }

  try {
    await createMaterialRecords({
      byteSize: bytes.byteLength,
      contentHash,
      courseId,
      filename,
      materialId,
      mediaType,
      pipelineVersion: serverEnvironment.materialPipelineVersion,
      storageKey,
      title,
      userId,
    });
  } catch (error) {
    await deletePrivateObject(storageKey).catch(() => undefined);
    throw error;
  }

  return materialId;
}

export async function createMaterialRecords({
  byteSize,
  contentHash,
  courseId,
  filename,
  materialId,
  mediaType,
  pipelineVersion,
  storageKey,
  title,
  userId,
}: {
  byteSize: number;
  contentHash: string;
  courseId: string;
  filename: string;
  materialId: string;
  mediaType: string;
  pipelineVersion: string;
  storageKey: string;
  title: string;
  userId: string;
}): Promise<void> {
  await db.transaction(async (tx) => {
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
      throw new MaterialManagementError(
        "Only course admins can upload course materials.",
      );
    }

    await tx.insert(materials).values({
      id: materialId,
      ownerId: userId,
      title,
      originalFilename: filename,
      mediaType,
      byteSize,
      contentHash,
      storageKey,
      status: "uploaded",
      sourceMetadata: { uploadedByUserId: userId },
    });
    await tx.insert(courseMaterials).values({
      courseId,
      materialId,
      attachedByUserId: userId,
    });
    await tx.insert(materialIngestionJobs).values({
      materialId,
      pipelineVersion,
    });
  });
}

export async function listCourseMaterialsForUser(
  userId: string,
  courseId: string,
): Promise<CourseMaterialSummary[]> {
  return db
    .select({
      id: materials.id,
      title: materials.title,
      originalFilename: materials.originalFilename,
      mediaType: materials.mediaType,
      byteSize: materials.byteSize,
      status: materials.status,
      failureReason: materials.failureReason,
      createdAt: materials.createdAt,
    })
    .from(courseMemberships)
    .innerJoin(
      courseMaterials,
      eq(courseMaterials.courseId, courseMemberships.courseId),
    )
    .innerJoin(materials, eq(materials.id, courseMaterials.materialId))
    .where(
      and(
        eq(courseMemberships.userId, userId),
        eq(courseMemberships.courseId, courseId),
      ),
    )
    .orderBy(asc(materials.createdAt))
    .then((rows) =>
      rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    );
}

async function requireCourseAdmin(
  userId: string,
  courseId: string,
): Promise<void> {
  const [membership] = await db
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
    throw new MaterialManagementError(
      "Only course admins can upload course materials.",
    );
  }
}
