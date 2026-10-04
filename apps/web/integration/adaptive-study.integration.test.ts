import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  answerMicroLessonMcq,
  completeAdaptiveStudySession,
  getAdaptiveStudyView,
  getPrivatePracticeQuestion,
  persistGradedAnswer,
  startAdaptiveMicroLesson,
  startAdaptiveStudySession,
  storePracticeQuestion,
} from "../lib/db/adaptive-study";
import { db, pool } from "../lib/db";
import {
  createCourseForUser,
  getCourseForUser,
} from "../lib/db/course-management";
import {
  activityEvents,
  assessmentEvidence,
  courses,
  microLessonAnswers,
  microLessons,
  practiceQuestions,
  userSelfAssessments,
  userTopicMastery,
  users,
} from "../lib/db/schema";

const testId = crypto.randomUUID();
const ownerId = `phase7-owner-${testId}`;
const outsiderId = `phase7-outsider-${testId}`;

beforeAll(async () => {
  await db.insert(users).values([
    { id: ownerId, name: "Phase 7 Owner", email: `${ownerId}@cadebit.test` },
    {
      id: outsiderId,
      name: "Phase 7 Outsider",
      email: `${outsiderId}@cadebit.test`,
    },
  ]);
});

afterAll(async () => {
  await db.delete(courses).where(eq(courses.ownerId, ownerId));
  await db.delete(users).where(inArray(users.id, [ownerId, outsiderId]));
  await pool.end();
});

describe("adaptive study persistence", () => {
  it("isolates courses and transactionally persists evidence and system mastery", async () => {
    const courseId = await createCourseForUser(ownerId, {
      name: "Adaptive Integration Course",
      description: "Phase 7 persistence coverage.",
      type: "independent",
      targetDate: "2026-09-20",
      outline: [{ name: "Closures", children: [] }],
    });
    const course = await getCourseForUser(ownerId, courseId);
    const topicId = course!.topics[0].id;
    await startAdaptiveStudySession({ userId: ownerId, courseId, topicId });
    const view = await getAdaptiveStudyView(ownerId, courseId);
    const sessionId = view!.session!.id;

    expect(await getAdaptiveStudyView(outsiderId, courseId)).toBeNull();

    await storePracticeQuestion({
      userId: ownerId,
      courseId,
      topicId,
      sessionId,
      generated: {
        requestId: "question-request",
        responseId: "question-response",
        question: "What does a closure retain?",
        referenceAnswer: "Its lexical environment.",
        gradingRubric: "Require lexical environment for full credit.",
        difficulty: 0.8,
        sources: [],
        model: "test-model",
        promptVersion: "practice-question-v1",
        usage: null,
      },
    });
    const [stored] = await db
      .select({ id: practiceQuestions.id })
      .from(practiceQuestions)
      .where(eq(practiceQuestions.studySessionId, sessionId));

    await expect(
      getPrivatePracticeQuestion(outsiderId, courseId, stored.id),
    ).rejects.toThrow("Practice question not found.");

    const question = await getPrivatePracticeQuestion(
      ownerId,
      courseId,
      stored.id,
    );
    await persistGradedAnswer({
      userId: ownerId,
      question,
      answer: "It retains variables from its lexical environment.",
      graded: {
        requestId: "grade-request",
        responseId: "grade-response",
        score: 0.9,
        correct: true,
        feedback: "Correct.",
        strengths: ["Lexical environment"],
        gaps: [],
        model: "test-model",
        promptVersion: "practice-grading-v1",
        usage: null,
      },
    });

    const [mastery] = await db
      .select()
      .from(userTopicMastery)
      .where(
        and(
          eq(userTopicMastery.userId, ownerId),
          eq(userTopicMastery.topicId, topicId),
        ),
      );
    const [evidence] = await db
      .select()
      .from(assessmentEvidence)
      .where(eq(assessmentEvidence.studySessionId, sessionId));
    const selfAssessments = await db
      .select()
      .from(userSelfAssessments)
      .where(eq(userSelfAssessments.userId, ownerId));

    expect(Number(mastery.score)).toBe(0.9);
    expect(mastery.formulaVersion).toBe("mastery-v1-weighted-recent-8");
    expect(evidence.rawEvidence).toMatchObject({
      studentAnswer: "It retains variables from its lexical environment.",
      gradingRubric: "Require lexical environment for full credit.",
    });
    expect(selfAssessments).toHaveLength(0);

    await completeAdaptiveStudySession(ownerId, courseId, sessionId);
    const [activity] = await db
      .select()
      .from(activityEvents)
      .where(eq(activityEvents.studySessionId, sessionId));
    expect(activity.eventType).toBe("adaptive_study_session_completed");
  });

  it("stores one canonical lesson and deterministically grades MCQ evidence", async () => {
    const courseId = await createCourseForUser(ownerId, {
      name: "Micro-lesson Integration Course",
      description: "Phase 9D persistence coverage.",
      type: "independent",
      targetDate: "2026-09-20",
      outline: [{ name: "Lexical scope", children: [] }],
    });
    const course = await getCourseForUser(ownerId, courseId);
    const topicId = course!.topics[0].id;
    await startAdaptiveMicroLesson({
      userId: ownerId,
      courseId,
      topicId,
      generated: {
        requestId: "lesson-request",
        responseId: "lesson-response",
        lesson: {
          topic: { id: topicId, name: "Lexical scope" },
          learningObjective: "Apply lexical scope to a closure.",
          estimatedMinutes: 6,
          targetDifficulty: 0.6,
          blocks: [
            {
              id: "teach",
              type: "explanation",
              heading: null,
              body: "Closures retain their defining lexical environment.",
            },
            {
              id: "check",
              type: "mcq",
              prompt: "Which scope supplies the retained binding?",
              choices: [
                {
                  id: "a",
                  text: "Defining lexical scope",
                  feedback: "Correct.",
                  misconception: null,
                },
                {
                  id: "b",
                  text: "Caller's dynamic scope",
                  feedback: "The caller does not redefine lexical capture.",
                  misconception: "Confuses lexical and dynamic scope.",
                },
                {
                  id: "c",
                  text: "Global scope",
                  feedback: "Too broad.",
                  misconception: null,
                },
                {
                  id: "d",
                  text: "No scope",
                  feedback: "A binding is retained.",
                  misconception: null,
                },
              ],
              correctChoiceId: "a",
              explanation:
                "The defining lexical environment supplies the binding.",
              difficulty: 0.6,
            },
            {
              id: "check-2",
              type: "mcq",
              prompt: "Which workload best fits a GPU?",
              choices: [
                {
                  id: "a2",
                  text: "Many independent operations",
                  feedback: "Correct.",
                  misconception: null,
                },
                {
                  id: "b2",
                  text: "One branch",
                  feedback: "Too sequential.",
                  misconception: null,
                },
                {
                  id: "c2",
                  text: "Setup only",
                  feedback: "Too little parallel work.",
                  misconception: null,
                },
                {
                  id: "d2",
                  text: "No work",
                  feedback: "No computation.",
                  misconception: null,
                },
              ],
              correctChoiceId: "a2",
              explanation: "Independent operations expose data parallelism.",
              difficulty: 0.7,
            },
          ],
        },
        sources: [],
        model: "test-model",
        promptVersion: "micro-lesson-v1",
        usage: null,
      },
    });
    const before = await getAdaptiveStudyView(ownerId, courseId);
    const lessonId = before!.session!.lesson!.id;
    expect(JSON.stringify(before!.session!.lesson)).not.toContain(
      "correctChoiceId",
    );
    expect(JSON.stringify(before!.session!.lesson)).not.toContain("Correct.");

    await expect(
      answerMicroLessonMcq({
        userId: outsiderId,
        courseId,
        lessonId,
        blockId: "check",
        selectedChoiceId: "a",
      }),
    ).rejects.toThrow("Active micro-lesson not found.");
    await expect(
      answerMicroLessonMcq({
        userId: ownerId,
        courseId,
        lessonId,
        blockId: "check-2",
        selectedChoiceId: "a2",
      }),
    ).rejects.toThrow("Answer the current lesson question first.");
    await answerMicroLessonMcq({
      userId: ownerId,
      courseId,
      lessonId,
      blockId: "check",
      selectedChoiceId: "b",
    });

    const after = await getAdaptiveStudyView(ownerId, courseId);
    expect(after!.session!.lesson!.blocks[1]).toMatchObject({
      result: {
        selectedChoiceId: "b",
        correct: false,
        misconception: "Confuses lexical and dynamic scope.",
      },
    });
    const [answer] = await db
      .select()
      .from(microLessonAnswers)
      .where(eq(microLessonAnswers.microLessonId, lessonId));
    const [storedLesson] = await db
      .select()
      .from(microLessons)
      .where(eq(microLessons.id, lessonId));
    const [evidence] = await db
      .select()
      .from(assessmentEvidence)
      .where(
        and(
          eq(assessmentEvidence.studySessionId, storedLesson.studySessionId),
          eq(assessmentEvidence.evidenceType, "micro_lesson_mcq"),
        ),
      );
    expect(answer).toMatchObject({ selectedChoiceId: "b", correct: false });
    expect(evidence.rawEvidence).toMatchObject({
      correctChoiceId: "a",
      misconception: "Confuses lexical and dynamic scope.",
    });
  });
});
