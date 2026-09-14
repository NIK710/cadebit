"use server";

import { revalidatePath } from "next/cache";

import {
  AiServiceError,
  generatePracticeQuestion,
  gradePracticeAnswer,
} from "@/lib/ai-service";
import {
  AdaptiveStudyError,
  completeAdaptiveStudySession,
  getAdaptiveStudyView,
  getPrivatePracticeQuestion,
  persistGradedAnswer,
  requireActiveStudySession,
  startAdaptiveStudySession,
  storePracticeQuestion,
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
      await startAdaptiveStudySession({
        courseId,
        topicId,
        userId: session.userId,
      });
    } else if (intent === "generate") {
      const sessionId = textValue(formData, "sessionId");
      const difficulty = Number(textValue(formData, "difficulty"));
      if (
        !isUuid(sessionId) ||
        !Number.isFinite(difficulty) ||
        difficulty < 0 ||
        difficulty > 1
      ) {
        return { error: "Choose a valid question difficulty." };
      }
      const active = await requireActiveStudySession(
        session.userId,
        courseId,
        sessionId,
      );
      const generated = await generatePracticeQuestion({
        userId: session.userId,
        courseId,
        topicId: active.topicId,
        difficulty,
      });
      await storePracticeQuestion({
        generated,
        sessionId,
        userId: session.userId,
        courseId,
        topicId: active.topicId,
      });
    } else if (intent === "answer") {
      const questionId = textValue(formData, "questionId");
      const answer = textValue(formData, "answer");
      if (!isUuid(questionId)) return { error: "Invalid practice question." };
      if (answer.length < 1 || answer.length > 12_000) {
        return { error: "Your answer must contain 1 to 12,000 characters." };
      }
      const question = await getPrivatePracticeQuestion(
        session.userId,
        courseId,
        questionId,
      );
      const graded = await gradePracticeAnswer({
        userId: session.userId,
        courseId,
        topicId: question.topicId,
        question: question.question,
        referenceAnswer: question.referenceAnswer,
        gradingRubric: question.gradingRubric,
        studentAnswer: answer,
        difficulty: question.difficulty,
      });
      await persistGradedAnswer({
        answer,
        graded,
        question,
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
    if (
      error instanceof AdaptiveStudyError ||
      error instanceof AiServiceError
    ) {
      return { error: error.message };
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
