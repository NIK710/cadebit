"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isValidJoinCode } from "@/lib/courses";
import {
  addCourseTopic,
  CourseManagementError,
  createCourseForUser,
  deleteCourseTopic,
  joinSharedCourse,
  renameCourseTopic,
  setTopicCompletion,
  setTopicConfidence,
  updateTargetDate,
} from "@/lib/db/course-management";
import {
  MaterialManagementError,
  MAX_MATERIAL_BYTES,
  SUPPORTED_MATERIAL_TYPES,
  uploadMaterialForCourse,
} from "@/lib/db/material-management";
import { requireSession } from "@/lib/session";

export type CourseActionState = {
  error?: string;
  success?: string;
};

export async function createCourseAction(
  _state: CourseActionState,
  formData: FormData,
): Promise<CourseActionState> {
  const session = await requireSession();
  const name = textValue(formData, "name");
  const description = textValue(formData, "description");
  const type = textValue(formData, "type");
  const targetDate = optionalDate(formData, "targetDate");
  const topicOutline = textValue(formData, "topicOutline");

  if (name.length < 2 || name.length > 120) {
    return { error: "Course name must contain 2 to 120 characters." };
  }
  if (description.length > 2_000) {
    return { error: "Description must contain at most 2,000 characters." };
  }
  if (type !== "shared" && type !== "independent") {
    return { error: "Choose a valid course type." };
  }
  if (targetDate === undefined) return { error: "Enter a valid target date." };

  let courseId: string;
  try {
    courseId = await createCourseForUser(session.userId, {
      name,
      description,
      type,
      targetDate,
      topicOutline,
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/dashboard");
  revalidatePath("/courses");
  redirect(`/courses/${courseId}`);
}

export async function joinCourseAction(
  _state: CourseActionState,
  formData: FormData,
): Promise<CourseActionState> {
  const session = await requireSession();
  const joinCode = textValue(formData, "joinCode");
  if (!isValidJoinCode(joinCode)) {
    return { error: "Enter the six-character course code." };
  }

  let courseId: string;
  try {
    courseId = await joinSharedCourse(session.userId, joinCode);
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/dashboard");
  revalidatePath("/courses");
  redirect(`/courses/${courseId}`);
}

export async function addTopicAction(
  courseId: string,
  _state: CourseActionState,
  formData: FormData,
): Promise<CourseActionState> {
  const session = await requireSession();
  const name = textValue(formData, "name");
  const parentId = textValue(formData, "parentId") || null;
  if (!isUuid(courseId) || (parentId !== null && !isUuid(parentId))) {
    return { error: "Invalid course or parent topic." };
  }
  if (name.length < 2 || name.length > 160) {
    return { error: "Topic name must contain 2 to 160 characters." };
  }

  try {
    await addCourseTopic({ courseId, name, parentId, userId: session.userId });
    revalidateCourse(courseId);
    return { success: parentId ? "Subtopic added." : "Topic added." };
  } catch (error) {
    return actionError(error);
  }
}

export async function renameTopicAction(
  courseId: string,
  _state: CourseActionState,
  formData: FormData,
): Promise<CourseActionState> {
  const session = await requireSession();
  const topicId = textValue(formData, "topicId");
  const name = textValue(formData, "name");
  if (!isUuid(courseId) || !isUuid(topicId)) return { error: "Invalid topic." };
  if (name.length < 2 || name.length > 160) {
    return { error: "Topic name must contain 2 to 160 characters." };
  }

  try {
    await renameCourseTopic({
      courseId,
      topicId,
      name,
      userId: session.userId,
    });
    revalidateCourse(courseId);
    return { success: "Topic renamed." };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteTopicAction(
  courseId: string,
  _state: CourseActionState,
  formData: FormData,
): Promise<CourseActionState> {
  const session = await requireSession();
  const topicId = textValue(formData, "topicId");
  if (!isUuid(courseId) || !isUuid(topicId)) return { error: "Invalid topic." };

  try {
    await deleteCourseTopic({ courseId, topicId, userId: session.userId });
    revalidateCourse(courseId);
    return { success: "Topic deleted." };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateTargetDateAction(
  courseId: string,
  _state: CourseActionState,
  formData: FormData,
): Promise<CourseActionState> {
  const session = await requireSession();
  const targetDate = optionalDate(formData, "targetDate");
  if (!isUuid(courseId)) return { error: "Invalid course." };
  if (targetDate === undefined) return { error: "Enter a valid target date." };

  try {
    await updateTargetDate({ courseId, targetDate, userId: session.userId });
    revalidateCourse(courseId);
    return { success: "Your target date was updated." };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateCompletionAction(
  courseId: string,
  _state: CourseActionState,
  formData: FormData,
): Promise<CourseActionState> {
  const session = await requireSession();
  const topicId = textValue(formData, "topicId");
  const completed = textValue(formData, "completed") === "true";
  if (!isUuid(courseId) || !isUuid(topicId)) return { error: "Invalid topic." };

  try {
    await setTopicCompletion({
      courseId,
      topicId,
      completed,
      userId: session.userId,
    });
    revalidateCourse(courseId);
    return { success: completed ? "Marked complete." : "Marked incomplete." };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateConfidenceAction(
  courseId: string,
  _state: CourseActionState,
  formData: FormData,
): Promise<CourseActionState> {
  const session = await requireSession();
  const topicId = textValue(formData, "topicId");
  const rating = Number(textValue(formData, "rating"));
  if (!isUuid(courseId) || !isUuid(topicId)) return { error: "Invalid topic." };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "Confidence must be between 1 and 5." };
  }

  try {
    await setTopicConfidence({
      courseId,
      topicId,
      rating,
      userId: session.userId,
    });
    revalidateCourse(courseId);
    return { success: "Confidence updated." };
  } catch (error) {
    return actionError(error);
  }
}

export async function uploadCourseMaterialAction(
  courseId: string,
  _state: CourseActionState,
  formData: FormData,
): Promise<CourseActionState> {
  const session = await requireSession();
  const title = textValue(formData, "title");
  const value = formData.get("material");
  if (!isUuid(courseId)) return { error: "Invalid course." };
  if (title.length < 2 || title.length > 200) {
    return { error: "Material title must contain 2 to 200 characters." };
  }
  if (!(value instanceof File) || value.size === 0) {
    return { error: "Choose a non-empty PDF, text, or Markdown file." };
  }
  if (value.size > MAX_MATERIAL_BYTES) {
    return { error: "Course materials must be 20 MB or smaller." };
  }
  if (!SUPPORTED_MATERIAL_TYPES.has(value.type)) {
    return { error: "Only PDF, plain text, and Markdown files are supported." };
  }

  try {
    await uploadMaterialForCourse({
      bytes: new Uint8Array(await value.arrayBuffer()),
      courseId,
      filename: value.name,
      mediaType: value.type,
      title,
      userId: session.userId,
    });
    revalidateCourse(courseId);
    return { success: "Material uploaded and queued for processing." };
  } catch (error) {
    if (error instanceof MaterialManagementError) {
      return { error: error.message };
    }
    return actionError(error);
  }
}

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalDate(
  formData: FormData,
  key: string,
): string | null | undefined {
  const value = textValue(formData, key);
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) ||
    date.toISOString().slice(0, 10) !== value
    ? undefined
    : value;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function actionError(error: unknown): CourseActionState {
  if (error instanceof CourseManagementError) return { error: error.message };
  console.error("Course action failed", error);
  return { error: "The request could not be completed. Please try again." };
}

function revalidateCourse(courseId: string): void {
  revalidatePath("/dashboard");
  revalidatePath("/courses");
  revalidatePath(`/courses/${courseId}`);
}
