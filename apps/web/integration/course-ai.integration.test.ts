import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { GeneratedCourseChatResponse } from "../lib/ai-service";
import { db, pool } from "../lib/db";
import {
  appendCourseAiTurn,
  getCourseAiConversationView,
  prepareCourseAiTurn,
  resetCourseAiConversation,
} from "../lib/db/course-ai";
import { createCourseForUser } from "../lib/db/course-management";
import {
  assessmentEvidence,
  courseAiConversations,
  courseAiMessages,
  courses,
  userSelfAssessments,
  userTopicMastery,
  users,
} from "../lib/db/schema";

const testId = crypto.randomUUID();
const ownerId = `chat-owner-${testId}`;
const outsiderId = `chat-outsider-${testId}`;

beforeAll(async () => {
  await db.insert(users).values([
    { id: ownerId, name: "Chat Owner", email: `${ownerId}@cadebit.test` },
    {
      id: outsiderId,
      name: "Chat Outsider",
      email: `${outsiderId}@cadebit.test`,
    },
  ]);
});

afterAll(async () => {
  await db.delete(courses).where(eq(courses.ownerId, ownerId));
  await db.delete(users).where(inArray(users.id, [ownerId, outsiderId]));
  await pool.end();
});

function groundedResponse(sequence: number): GeneratedCourseChatResponse {
  return {
    requestId: `request-${sequence}`,
    responseId: `response-${sequence}`,
    content: `Grounded answer ${sequence} [1].`,
    groundingStatus: "grounded",
    sources: [
      {
        materialId: "86a9168a-6a1d-4d63-b77f-f1582fe67346",
        materialTitle: "Course Notes",
        chunkId: "1c4cc166-2ca4-430e-a51c-84380980df57",
        pageNumber: 4,
        section: "Relevant section",
        excerpt: "Relevant source content.",
      },
    ],
    model: "test-model",
    promptVersion: "course-chat-v1",
    usage: null,
  };
}

describe("course AI persistence", () => {
  it("persists one isolated conversation without creating learning evidence", async () => {
    const courseId = await createCourseForUser(ownerId, {
      name: "Course Chat Integration",
      description: "Course chat persistence coverage.",
      type: "independent",
      targetDate: null,
      outline: [{ name: "Warp divergence", children: [] }],
    });
    expect(await getCourseAiConversationView(outsiderId, courseId)).toBeNull();
    await expect(
      prepareCourseAiTurn({
        userId: outsiderId,
        courseId,
        conversationId: null,
        expectedRevision: 0,
      }),
    ).rejects.toThrow("Course access denied");

    const prepared = await prepareCourseAiTurn({
      userId: ownerId,
      courseId,
      conversationId: null,
      expectedRevision: 0,
    });
    const view = await appendCourseAiTurn({
      userId: ownerId,
      courseId,
      conversationId: prepared.conversationId,
      revision: prepared.revision,
      message: "Why does divergence matter?",
      response: groundedResponse(1),
    });

    expect(view.revision).toBe(1);
    expect(view.messages).toHaveLength(2);
    expect(view.messages[1].sources[0].section).toBe("Relevant section");
    expect(await getCourseAiConversationView(ownerId, courseId)).toEqual(view);
    const conversations = await db
      .select()
      .from(courseAiConversations)
      .where(
        and(
          eq(courseAiConversations.userId, ownerId),
          eq(courseAiConversations.courseId, courseId),
        ),
      );
    expect(conversations).toHaveLength(1);
    expect(
      await db
        .select()
        .from(assessmentEvidence)
        .where(eq(assessmentEvidence.courseId, courseId)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(userTopicMastery)
        .where(eq(userTopicMastery.courseId, courseId)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(userSelfAssessments)
        .where(eq(userSelfAssessments.userId, ownerId)),
    ).toHaveLength(0);

    await expect(
      appendCourseAiTurn({
        userId: ownerId,
        courseId,
        conversationId: prepared.conversationId,
        revision: prepared.revision,
        message: "A stale concurrent message",
        response: groundedResponse(2),
      }),
    ).rejects.toThrow("changed in another tab");
  });

  it("bounds model context and permanently resets the single conversation", async () => {
    const courseId = await createCourseForUser(ownerId, {
      name: "Course Chat Reset",
      description: "Course chat reset coverage.",
      type: "independent",
      targetDate: null,
      outline: [],
    });
    let prepared = await prepareCourseAiTurn({
      userId: ownerId,
      courseId,
      conversationId: null,
      expectedRevision: 0,
    });
    const originalConversationId = prepared.conversationId;
    for (let turn = 0; turn < 7; turn += 1) {
      await appendCourseAiTurn({
        userId: ownerId,
        courseId,
        conversationId: prepared.conversationId,
        revision: prepared.revision,
        message: `Question ${turn}`,
        response: groundedResponse(turn),
      });
      prepared = await prepareCourseAiTurn({
        userId: ownerId,
        courseId,
        conversationId: prepared.conversationId,
        expectedRevision: prepared.revision + 1,
      });
    }
    expect(prepared.history).toHaveLength(12);
    expect(prepared.history[0].content).toBe("Question 1");

    const reset = await resetCourseAiConversation(ownerId, courseId);
    expect(reset.id).not.toBe(originalConversationId);
    expect(reset.messages).toHaveLength(0);
    expect(
      await db
        .select()
        .from(courseAiMessages)
        .where(eq(courseAiMessages.conversationId, originalConversationId)),
    ).toHaveLength(0);
    const conversations = await db
      .select()
      .from(courseAiConversations)
      .where(
        and(
          eq(courseAiConversations.userId, ownerId),
          eq(courseAiConversations.courseId, courseId),
        ),
      );
    expect(conversations).toHaveLength(1);
  });
});
