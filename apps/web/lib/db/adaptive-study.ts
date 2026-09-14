import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";

import {
  deriveMasterySignal,
  MASTERY_FORMULA_VERSION,
  recommendNextTopic,
  type TopicRecommendation,
} from "../adaptive-study";
import type {
  GeneratedPracticeQuestion,
  GradedPracticeAnswer,
  SourceReference,
} from "../ai-service";
import { db } from ".";
import {
  activityEvents,
  assessmentEvidence,
  courseMemberships,
  courses,
  practiceQuestions,
  scheduleItems,
  studySessions,
  topics,
  userCourseSchedules,
  userTopicMastery,
  userTopicProgress,
} from "./schema";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class AdaptiveStudyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdaptiveStudyError";
  }
}

export type StudyTopicOption = { id: string; name: string };
export type SafePracticeQuestion = {
  id: string;
  question: string;
  difficulty: number;
  sources: SourceReference[];
};
export type SafeGradeResult = {
  score: number;
  correct: boolean;
  feedback: string;
  strengths: string[];
  gaps: string[];
};
export type AdaptiveStudyView = {
  courseId: string;
  courseName: string;
  topics: StudyTopicOption[];
  recommendation: TopicRecommendation | null;
  session: null | {
    id: string;
    topicId: string;
    topicName: string;
    startedAt: string;
    question: SafePracticeQuestion | null;
    latestResult: SafeGradeResult | null;
    mastery: number | null;
  };
};

export type PrivatePracticeQuestion = {
  id: string;
  courseId: string;
  topicId: string;
  studySessionId: string;
  question: string;
  referenceAnswer: string;
  gradingRubric: string;
  difficulty: number;
};

export async function getAdaptiveStudyView(
  userId: string,
  courseId: string,
): Promise<AdaptiveStudyView | null> {
  const [membership] = await db
    .select({ name: courses.name })
    .from(courseMemberships)
    .innerJoin(courses, eq(courses.id, courseMemberships.courseId))
    .where(
      and(
        eq(courseMemberships.userId, userId),
        eq(courseMemberships.courseId, courseId),
      ),
    )
    .limit(1);
  if (!membership) return null;

  const [topicRows, recommendation, activeRows] = await Promise.all([
    db
      .select({ id: topics.id, name: topics.name })
      .from(topics)
      .where(eq(topics.courseId, courseId))
      .orderBy(asc(topics.position), asc(topics.createdAt)),
    getRecommendation(userId, courseId),
    db
      .select({
        id: studySessions.id,
        topicId: studySessions.topicId,
        topicName: topics.name,
        startedAt: studySessions.startedAt,
      })
      .from(studySessions)
      .innerJoin(topics, eq(topics.id, studySessions.topicId))
      .where(
        and(
          eq(studySessions.userId, userId),
          eq(studySessions.courseId, courseId),
          eq(studySessions.status, "active"),
        ),
      )
      .orderBy(desc(studySessions.startedAt))
      .limit(1),
  ]);
  const active = activeRows[0];
  if (!active || !active.topicId) {
    return {
      courseId,
      courseName: membership.name,
      topics: topicRows,
      recommendation,
      session: null,
    };
  }

  const [question] = await db
    .select({
      id: practiceQuestions.id,
      question: practiceQuestions.question,
      difficulty: practiceQuestions.difficulty,
      sources: practiceQuestions.sourceReferences,
      answeredAt: practiceQuestions.answeredAt,
    })
    .from(practiceQuestions)
    .where(eq(practiceQuestions.studySessionId, active.id))
    .orderBy(desc(practiceQuestions.createdAt))
    .limit(1);

  let latestResult: SafeGradeResult | null = null;
  if (question?.answeredAt) {
    const [evidence] = await db
      .select({ raw: assessmentEvidence.rawEvidence })
      .from(assessmentEvidence)
      .where(
        and(
          eq(assessmentEvidence.studySessionId, active.id),
          eq(assessmentEvidence.evidenceType, "graded_practice_answer"),
        ),
      )
      .orderBy(desc(assessmentEvidence.occurredAt))
      .limit(1);
    latestResult = readSafeGradeResult(evidence?.raw);
  }
  const [mastery] = await db
    .select({ score: userTopicMastery.score })
    .from(userTopicMastery)
    .where(
      and(
        eq(userTopicMastery.userId, userId),
        eq(userTopicMastery.topicId, active.topicId),
      ),
    )
    .limit(1);

  return {
    courseId,
    courseName: membership.name,
    topics: topicRows,
    recommendation,
    session: {
      ...active,
      topicId: active.topicId,
      startedAt: active.startedAt.toISOString(),
      question:
        question && !question.answeredAt
          ? {
              id: question.id,
              question: question.question,
              difficulty: Number(question.difficulty),
              sources: question.sources as unknown as SourceReference[],
            }
          : null,
      latestResult,
      mastery: mastery ? Number(mastery.score) : null,
    },
  };
}

export async function startAdaptiveStudySession({
  courseId,
  topicId,
  userId,
}: {
  courseId: string;
  topicId: string;
  userId: string;
}): Promise<void> {
  await db.transaction(async (tx) => {
    await requireTopicAccess(tx, userId, courseId, topicId);
    await tx
      .update(studySessions)
      .set({ status: "abandoned", endedAt: new Date() })
      .where(
        and(
          eq(studySessions.userId, userId),
          eq(studySessions.courseId, courseId),
          eq(studySessions.status, "active"),
        ),
      );
    await tx.insert(studySessions).values({ userId, courseId, topicId });
  });
}

export async function requireActiveStudySession(
  userId: string,
  courseId: string,
  sessionId: string,
): Promise<{ id: string; topicId: string }> {
  const [session] = await db
    .select({ id: studySessions.id, topicId: studySessions.topicId })
    .from(studySessions)
    .innerJoin(
      courseMemberships,
      and(
        eq(courseMemberships.courseId, studySessions.courseId),
        eq(courseMemberships.userId, userId),
      ),
    )
    .where(
      and(
        eq(studySessions.id, sessionId),
        eq(studySessions.userId, userId),
        eq(studySessions.courseId, courseId),
        eq(studySessions.status, "active"),
      ),
    )
    .limit(1);
  if (!session?.topicId)
    throw new AdaptiveStudyError("Active study session not found.");
  return { id: session.id, topicId: session.topicId };
}

export async function storePracticeQuestion({
  generated,
  sessionId,
  userId,
  courseId,
  topicId,
}: {
  generated: GeneratedPracticeQuestion;
  sessionId: string;
  userId: string;
  courseId: string;
  topicId: string;
}): Promise<void> {
  await db.transaction(async (tx) => {
    await requireActiveSessionInTransaction(
      tx,
      userId,
      courseId,
      sessionId,
      topicId,
    );
    const [unanswered] = await tx
      .select({ id: practiceQuestions.id })
      .from(practiceQuestions)
      .where(
        and(
          eq(practiceQuestions.studySessionId, sessionId),
          isNull(practiceQuestions.answeredAt),
        ),
      )
      .limit(1);
    if (unanswered)
      throw new AdaptiveStudyError("Answer the current question first.");
    await tx.insert(practiceQuestions).values({
      studySessionId: sessionId,
      userId,
      courseId,
      topicId,
      question: generated.question,
      referenceAnswer: generated.referenceAnswer,
      gradingRubric: generated.gradingRubric,
      difficulty: generated.difficulty.toFixed(4),
      sourceReferences: generated.sources as unknown as Array<
        Record<string, unknown>
      >,
      model: generated.model,
      promptVersion: generated.promptVersion,
    });
  });
}

export async function getPrivatePracticeQuestion(
  userId: string,
  courseId: string,
  questionId: string,
): Promise<PrivatePracticeQuestion> {
  const [question] = await db
    .select({
      id: practiceQuestions.id,
      courseId: practiceQuestions.courseId,
      topicId: practiceQuestions.topicId,
      studySessionId: practiceQuestions.studySessionId,
      question: practiceQuestions.question,
      referenceAnswer: practiceQuestions.referenceAnswer,
      gradingRubric: practiceQuestions.gradingRubric,
      difficulty: practiceQuestions.difficulty,
    })
    .from(practiceQuestions)
    .innerJoin(
      studySessions,
      eq(studySessions.id, practiceQuestions.studySessionId),
    )
    .innerJoin(
      courseMemberships,
      and(
        eq(courseMemberships.courseId, practiceQuestions.courseId),
        eq(courseMemberships.userId, userId),
      ),
    )
    .where(
      and(
        eq(practiceQuestions.id, questionId),
        eq(practiceQuestions.userId, userId),
        eq(practiceQuestions.courseId, courseId),
        isNull(practiceQuestions.answeredAt),
        eq(studySessions.status, "active"),
      ),
    )
    .limit(1);
  if (!question) throw new AdaptiveStudyError("Practice question not found.");
  return { ...question, difficulty: Number(question.difficulty) };
}

export async function persistGradedAnswer({
  answer,
  graded,
  question,
  userId,
}: {
  answer: string;
  graded: GradedPracticeAnswer;
  question: PrivatePracticeQuestion;
  userId: string;
}): Promise<void> {
  await db.transaction(async (tx) => {
    await requireActiveSessionInTransaction(
      tx,
      userId,
      question.courseId,
      question.studySessionId,
      question.topicId,
    );
    const [claimed] = await tx
      .update(practiceQuestions)
      .set({ answeredAt: new Date() })
      .where(
        and(
          eq(practiceQuestions.id, question.id),
          eq(practiceQuestions.userId, userId),
          isNull(practiceQuestions.answeredAt),
        ),
      )
      .returning({ id: practiceQuestions.id });
    if (!claimed)
      throw new AdaptiveStudyError("This question was already answered.");

    const now = new Date();
    await tx.insert(assessmentEvidence).values({
      userId,
      courseId: question.courseId,
      topicId: question.topicId,
      studySessionId: question.studySessionId,
      evidenceType: "graded_practice_answer",
      score: graded.score.toFixed(4),
      maximumScore: "1",
      difficulty: question.difficulty.toFixed(4),
      model: graded.model,
      promptVersion: graded.promptVersion,
      rawEvidence: {
        questionId: question.id,
        question: question.question,
        referenceAnswer: question.referenceAnswer,
        gradingRubric: question.gradingRubric,
        studentAnswer: answer,
        score: graded.score,
        correct: graded.correct,
        feedback: graded.feedback,
        strengths: graded.strengths,
        gaps: graded.gaps,
        gradingRequestId: graded.requestId,
        gradingResponseId: graded.responseId,
        usage: graded.usage,
      },
      occurredAt: now,
    });

    const rows = await tx
      .select({
        score: assessmentEvidence.score,
        maximumScore: assessmentEvidence.maximumScore,
        difficulty: assessmentEvidence.difficulty,
      })
      .from(assessmentEvidence)
      .where(
        and(
          eq(assessmentEvidence.userId, userId),
          eq(assessmentEvidence.topicId, question.topicId),
          eq(assessmentEvidence.evidenceType, "graded_practice_answer"),
        ),
      )
      .orderBy(desc(assessmentEvidence.occurredAt))
      .limit(8);
    const validEvidence = rows
      .filter(
        (row) =>
          row.score !== null &&
          row.maximumScore !== null &&
          row.difficulty !== null,
      )
      .map((row) => ({
        score: Number(row.score),
        maximumScore: Number(row.maximumScore),
        difficulty: Number(row.difficulty),
      }));
    const mastery = deriveMasterySignal(validEvidence);
    await tx
      .insert(userTopicMastery)
      .values({
        userId,
        courseId: question.courseId,
        topicId: question.topicId,
        score: mastery.toFixed(4),
        evidenceCount: validEvidence.length,
        formulaVersion: MASTERY_FORMULA_VERSION,
        lastAssessedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [userTopicMastery.userId, userTopicMastery.topicId],
        set: {
          courseId: question.courseId,
          score: mastery.toFixed(4),
          evidenceCount: validEvidence.length,
          formulaVersion: MASTERY_FORMULA_VERSION,
          lastAssessedAt: now,
          updatedAt: now,
        },
      });
    await tx
      .insert(userTopicProgress)
      .values({ userId, topicId: question.topicId, lastStudiedAt: now })
      .onConflictDoUpdate({
        target: [userTopicProgress.userId, userTopicProgress.topicId],
        set: { lastStudiedAt: now, updatedAt: now },
      });
  });
}

export async function completeAdaptiveStudySession(
  userId: string,
  courseId: string,
  sessionId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [session] = await tx
      .select({
        topicId: studySessions.topicId,
        startedAt: studySessions.startedAt,
      })
      .from(studySessions)
      .innerJoin(
        courseMemberships,
        and(
          eq(courseMemberships.courseId, studySessions.courseId),
          eq(courseMemberships.userId, userId),
        ),
      )
      .where(
        and(
          eq(studySessions.id, sessionId),
          eq(studySessions.userId, userId),
          eq(studySessions.courseId, courseId),
          eq(studySessions.status, "active"),
        ),
      )
      .limit(1);
    if (!session?.topicId)
      throw new AdaptiveStudyError("Active study session not found.");
    const endedAt = new Date();
    const durationSeconds = Math.max(
      0,
      Math.min(
        86_400,
        Math.floor((endedAt.valueOf() - session.startedAt.valueOf()) / 1000),
      ),
    );
    await tx
      .update(studySessions)
      .set({ status: "completed", endedAt })
      .where(eq(studySessions.id, sessionId));
    await tx.insert(activityEvents).values({
      userId,
      courseId,
      topicId: session.topicId,
      studySessionId: sessionId,
      eventType: "adaptive_study_session_completed",
      durationSeconds,
      metadata: { masteryFormulaVersion: MASTERY_FORMULA_VERSION },
      occurredAt: endedAt,
    });
    await tx
      .insert(userTopicProgress)
      .values({ userId, topicId: session.topicId, lastStudiedAt: endedAt })
      .onConflictDoUpdate({
        target: [userTopicProgress.userId, userTopicProgress.topicId],
        set: { lastStudiedAt: endedAt, updatedAt: endedAt },
      });
    const [schedule] = await tx
      .select({ id: userCourseSchedules.id })
      .from(userCourseSchedules)
      .where(
        and(
          eq(userCourseSchedules.userId, userId),
          eq(userCourseSchedules.courseId, courseId),
        ),
      )
      .limit(1);
    if (schedule) {
      await tx
        .update(scheduleItems)
        .set({ status: "completed", updatedAt: endedAt })
        .where(
          and(
            eq(scheduleItems.scheduleId, schedule.id),
            eq(scheduleItems.topicId, session.topicId),
            eq(scheduleItems.status, "planned"),
          ),
        );
    }
  });
}

async function getRecommendation(
  userId: string,
  courseId: string,
): Promise<TopicRecommendation | null> {
  const [topicRows, scheduleRows, [schedule]] = await Promise.all([
    db
      .select({
        id: topics.id,
        name: topics.name,
        position: topics.position,
        completedAt: userTopicProgress.completedAt,
        lastStudiedAt: userTopicProgress.lastStudiedAt,
        mastery: userTopicMastery.score,
      })
      .from(topics)
      .leftJoin(
        userTopicProgress,
        and(
          eq(userTopicProgress.topicId, topics.id),
          eq(userTopicProgress.userId, userId),
        ),
      )
      .leftJoin(
        userTopicMastery,
        and(
          eq(userTopicMastery.topicId, topics.id),
          eq(userTopicMastery.userId, userId),
        ),
      )
      .where(eq(topics.courseId, courseId)),
    db
      .select({
        topicId: scheduleItems.topicId,
        plannedFor: scheduleItems.plannedFor,
      })
      .from(scheduleItems)
      .innerJoin(
        userCourseSchedules,
        eq(userCourseSchedules.id, scheduleItems.scheduleId),
      )
      .where(
        and(
          eq(userCourseSchedules.userId, userId),
          eq(userCourseSchedules.courseId, courseId),
          eq(scheduleItems.status, "planned"),
        ),
      )
      .orderBy(asc(scheduleItems.plannedFor)),
    db
      .select({ targetDate: userCourseSchedules.targetDate })
      .from(userCourseSchedules)
      .where(
        and(
          eq(userCourseSchedules.userId, userId),
          eq(userCourseSchedules.courseId, courseId),
        ),
      )
      .limit(1),
  ]);
  const plannedByTopic = new Map<string, string>();
  scheduleRows.forEach((row) => {
    if (!plannedByTopic.has(row.topicId))
      plannedByTopic.set(row.topicId, row.plannedFor);
  });
  return recommendNextTopic(
    topicRows.map((row) => ({
      id: row.id,
      name: row.name,
      position: row.position,
      completed: row.completedAt !== null,
      mastery: row.mastery === null ? null : Number(row.mastery),
      lastStudiedAt: row.lastStudiedAt,
      plannedFor: plannedByTopic.get(row.id) ?? null,
    })),
    schedule?.targetDate ?? null,
  );
}

async function requireTopicAccess(
  tx: DatabaseTransaction,
  userId: string,
  courseId: string,
  topicId: string,
) {
  const [row] = await tx
    .select({ id: topics.id })
    .from(topics)
    .innerJoin(
      courseMemberships,
      and(
        eq(courseMemberships.courseId, topics.courseId),
        eq(courseMemberships.userId, userId),
      ),
    )
    .where(and(eq(topics.id, topicId), eq(topics.courseId, courseId)))
    .limit(1);
  if (!row)
    throw new AdaptiveStudyError(
      "The selected topic is not available in this course.",
    );
}

async function requireActiveSessionInTransaction(
  tx: DatabaseTransaction,
  userId: string,
  courseId: string,
  sessionId: string,
  topicId: string,
) {
  const [row] = await tx
    .select({ id: studySessions.id })
    .from(studySessions)
    .innerJoin(
      courseMemberships,
      and(
        eq(courseMemberships.courseId, studySessions.courseId),
        eq(courseMemberships.userId, userId),
      ),
    )
    .where(
      and(
        eq(studySessions.id, sessionId),
        eq(studySessions.userId, userId),
        eq(studySessions.courseId, courseId),
        eq(studySessions.topicId, topicId),
        eq(studySessions.status, "active"),
      ),
    )
    .limit(1);
  if (!row) throw new AdaptiveStudyError("Active study session not found.");
}

function readSafeGradeResult(
  raw: Record<string, unknown> | undefined,
): SafeGradeResult | null {
  if (
    !raw ||
    typeof raw.score !== "number" ||
    typeof raw.correct !== "boolean" ||
    typeof raw.feedback !== "string" ||
    !isStringArray(raw.strengths) ||
    !isStringArray(raw.gaps)
  )
    return null;
  return {
    score: raw.score,
    correct: raw.correct,
    feedback: raw.feedback,
    strengths: raw.strengths,
    gaps: raw.gaps,
  };
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}
