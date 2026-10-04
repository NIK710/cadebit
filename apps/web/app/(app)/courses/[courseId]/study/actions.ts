"use server";

import { revalidatePath } from "next/cache";

import { AiServiceError, generateMicroLesson } from "@/lib/ai-service";
import {
  AdaptiveStudyError,
  answerMicroLessonMcq,
  completeAdaptiveStudySession,
  getAdaptiveStudyView,
  getMicroLessonGenerationContext,
  startAdaptiveMicroLesson,
  type AdaptiveStudyView,
} from "@/lib/db/adaptive-study";
import { requireSession } from "@/lib/session";

export type AdaptiveStudyActionState = {
  error?: string;
  completed?: boolean;
  view?: AdaptiveStudyView;
};

export async function adaptiveStudyAction(
  courseId: string,
  _state: AdaptiveStudyActionState,
  formData: FormData,
): Promise<AdaptiveStudyActionState> {
  const session = await requireSession();
  if (!isUuid(courseId)) return { error: "Invalid course." };
  const intent = textValue(formData, "intent");

  try {
    if (intent === "start") {
      const topicId = textValue(formData, "topicId");
      if (!isUuid(topicId)) return { error: "Choose a valid topic." };
      const context = await getMicroLessonGenerationContext(
        session.userId,
        courseId,
        topicId,
      );
      const generated = await generateMicroLesson({
        userId: session.userId,
        courseId,
        topicId,
        topicName: context.topicName,
        topicContext: context.topicContext || undefined,
        systemMastery: context.systemMastery,
        recentAssessments: context.recentAssessments,
      });
      await startAdaptiveMicroLesson({
        courseId,
        generated,
        topicId,
        userId: session.userId,
      });
    } else if (intent === "answer") {
      const lessonId = textValue(formData, "lessonId");
      const blockId = textValue(formData, "blockId");
      const selectedChoiceId = textValue(formData, "selectedChoiceId");
      if (
        !isUuid(lessonId) ||
        !isBlockId(blockId) ||
        !isBlockId(selectedChoiceId)
      )
        return { error: "Choose a valid answer." };
      await answerMicroLessonMcq({
        blockId,
        courseId,
        lessonId,
        selectedChoiceId,
        userId: session.userId,
      });
    } else if (intent === "complete") {
      const sessionId = textValue(formData, "sessionId");
      if (!isUuid(sessionId)) return { error: "Invalid study session." };
      await completeAdaptiveStudySession(session.userId, courseId, sessionId);
      revalidateStudy(courseId);
      const view = await getAdaptiveStudyView(session.userId, courseId);
      return view ? { completed: true, view } : { error: "Course not found." };
    } else {
      return { error: "Unknown study action." };
    }

    revalidateStudy(courseId);
    const view = await getAdaptiveStudyView(session.userId, courseId);
    return view ? { view } : { error: "Course not found." };
  } catch (error) {
    if (error instanceof AdaptiveStudyError) {
      return { error: error.message };
    }
    if (error instanceof AiServiceError) {
      console.error("Micro-lesson generation failed", {
        code: error.code,
        status: error.status,
        requestId: error.requestId,
      });
      return { error: "Lesson generation failed. Try again." };
    }
    console.error("Adaptive study action failed", error);
    return {
      error: "The study action could not be completed. Please try again.",
    };
  }
}

function revalidateStudy(courseId: string): void {
  revalidatePath("/dashboard");
  revalidatePath(`/courses/${courseId}`);
  revalidatePath(`/courses/${courseId}/study`);
}

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isBlockId(value: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(value);
}
