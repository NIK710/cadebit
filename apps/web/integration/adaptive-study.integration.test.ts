import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  completeAdaptiveStudySession,
  getAdaptiveStudyView,
  getPrivatePracticeQuestion,
  persistGradedAnswer,
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
});
