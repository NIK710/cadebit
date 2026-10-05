"use server";

import { revalidatePath } from "next/cache";

import { AiServiceError, generateCourseChatResponse } from "@/lib/ai-service";
import {
  appendCourseAiTurn,
  CourseAiError,
  type CourseAiConversationView,
  prepareCourseAiTurn,
  resetCourseAiConversation,
} from "@/lib/db/course-ai";
import { requireSession } from "@/lib/session";

export type CourseAiActionState = {
  view: CourseAiConversationView;
  error?: string;
  sequence: number;
};

export async function courseAiAction(
  courseId: string,
  state: CourseAiActionState,
  formData: FormData,
): Promise<CourseAiActionState> {
  const session = await requireSession();
  const intent = textValue(formData, "intent");
  if (!isUuid(courseId)) return withError(state, "Invalid course.");

  if (intent === "reset") {
    try {
      const view = await resetCourseAiConversation(session.userId, courseId);
      revalidatePath(`/courses/${courseId}`);
      return { view, sequence: state.sequence + 1 };
    } catch (error) {
      return handleCourseAiError(state, error);
    }
  }
  if (intent !== "send") return withError(state, "Invalid chat action.");

  const message = textValue(formData, "message");
  const conversationId = textValue(formData, "conversationId") || null;
  const revision = Number(textValue(formData, "revision"));
  if (message.length < 1 || message.length > 4_000) {
    return withError(state, "Your message must contain 1 to 4,000 characters.");
  }
  if (conversationId !== null && !isUuid(conversationId)) {
    return withError(state, "Invalid conversation.");
  }
  if (!Number.isInteger(revision) || revision < 0) {
    return withError(state, "Invalid conversation version.");
  }

  try {
    const prepared = await prepareCourseAiTurn({
      userId: session.userId,
      courseId,
      conversationId,
      expectedRevision: revision,
    });
    const response = await generateCourseChatResponse({
      userId: session.userId,
      courseId,
      message,
      history: prepared.history,
    });
    const view = await appendCourseAiTurn({
      userId: session.userId,
      courseId,
      conversationId: prepared.conversationId,
      revision: prepared.revision,
      message,
      response,
    });
    revalidatePath(`/courses/${courseId}`);
    return { view, sequence: state.sequence + 1 };
  } catch (error) {
    return handleCourseAiError(state, error);
  }
}

function handleCourseAiError(
  state: CourseAiActionState,
  error: unknown,
): CourseAiActionState {
  if (error instanceof CourseAiError) {
    const message =
      error.code === "access_denied"
        ? "You no longer have access to this course."
        : "This conversation changed in another tab. Reopen the page and try again.";
    return withError(state, message);
  }
  if (error instanceof AiServiceError) {
    console.error("Course chat service request failed", {
      code: error.code,
      status: error.status,
      requestId: error.requestId,
    });
    if (error.status === 403) {
      return withError(state, "You no longer have access to this course.");
    }
    if (error.status === 504 || error.code.includes("timeout")) {
      return withError(state, "CadeBit took too long to respond. Try again.");
    }
    return withError(
      state,
      "CadeBit AI is temporarily unavailable. Try again.",
    );
  }
  console.error("Course chat action failed", error);
  return withError(state, "CadeBit AI could not respond. Try again.");
}

function withError(
  state: CourseAiActionState,
  error: string,
): CourseAiActionState {
  return { ...state, error };
}

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
