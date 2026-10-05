import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import type {
  ChatContextMessage,
  GeneratedCourseChatResponse,
  GroundingStatus,
  SourceReference,
} from "../ai-service";
import { db } from ".";
import {
  courseAiConversations,
  courseAiMessages,
  courseMemberships,
} from "./schema";

const CHAT_CONTEXT_MESSAGE_LIMIT = 12;
const CHAT_CONTEXT_CHARACTER_LIMIT = 12_000;
const CHAT_DISPLAY_MESSAGE_LIMIT = 100;

export type CourseAiMessageView = {
  id: string;
  role: "user" | "assistant";
  content: string;
  groundingStatus: GroundingStatus | null;
  sources: SourceReference[];
  createdAt: string;
};

export type CourseAiConversationView = {
  id: string | null;
  revision: number;
  messages: CourseAiMessageView[];
  earlierMessagesOmitted: boolean;
};

export type PreparedCourseAiTurn = {
  conversationId: string;
  revision: number;
  history: ChatContextMessage[];
};

export class CourseAiError extends Error {
  constructor(
    message: string,
    readonly code: "access_denied" | "conversation_changed",
  ) {
    super(message);
    this.name = "CourseAiError";
  }
}

export async function getCourseAiConversationView(
  userId: string,
  courseId: string,
): Promise<CourseAiConversationView | null> {
  if (!(await hasCourseMembership(userId, courseId))) return null;
  const conversation = await findConversation(userId, courseId);
  if (!conversation) return emptyConversationView();
  return loadConversationView(conversation.id, conversation.revision);
}

export async function prepareCourseAiTurn({
  userId,
  courseId,
  conversationId,
  expectedRevision,
}: {
  userId: string;
  courseId: string;
  conversationId: string | null;
  expectedRevision: number;
}): Promise<PreparedCourseAiTurn> {
  return db.transaction(async (tx) => {
    const [membership] = await tx
      .select({ userId: courseMemberships.userId })
      .from(courseMemberships)
      .where(
        and(
          eq(courseMemberships.userId, userId),
          eq(courseMemberships.courseId, courseId),
        ),
      )
      .limit(1);
    if (!membership)
      throw new CourseAiError("Course access denied.", "access_denied");

    await tx
      .insert(courseAiConversations)
      .values({ userId, courseId })
      .onConflictDoNothing();
    const [conversation] = await tx
      .select({
        id: courseAiConversations.id,
        revision: courseAiConversations.revision,
      })
      .from(courseAiConversations)
      .where(
        and(
          eq(courseAiConversations.userId, userId),
          eq(courseAiConversations.courseId, courseId),
        ),
      )
      .limit(1);
    if (
      !conversation ||
      (conversationId !== null && conversation.id !== conversationId) ||
      conversation.revision !== expectedRevision
    ) {
      throw new CourseAiError(
        "This conversation changed in another tab.",
        "conversation_changed",
      );
    }

    const rows = await tx
      .select({
        role: courseAiMessages.role,
        content: courseAiMessages.content,
      })
      .from(courseAiMessages)
      .where(eq(courseAiMessages.conversationId, conversation.id))
      .orderBy(desc(courseAiMessages.position))
      .limit(CHAT_CONTEXT_MESSAGE_LIMIT);
    return {
      conversationId: conversation.id,
      revision: conversation.revision,
      history: boundContext(rows.reverse()),
    };
  });
}

export async function appendCourseAiTurn({
  userId,
  courseId,
  conversationId,
  revision,
  message,
  response,
}: {
  userId: string;
  courseId: string;
  conversationId: string;
  revision: number;
  message: string;
  response: GeneratedCourseChatResponse;
}): Promise<CourseAiConversationView> {
  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(courseAiConversations)
      .set({
        revision: sql`${courseAiConversations.revision} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(courseAiConversations.id, conversationId),
          eq(courseAiConversations.userId, userId),
          eq(courseAiConversations.courseId, courseId),
          eq(courseAiConversations.revision, revision),
        ),
      )
      .returning({ id: courseAiConversations.id });
    if (!updated) {
      throw new CourseAiError(
        "This conversation changed in another tab.",
        "conversation_changed",
      );
    }
    const firstPosition = revision * 2;
    await tx.insert(courseAiMessages).values([
      {
        conversationId,
        position: firstPosition,
        role: "user",
        content: message,
      },
      {
        conversationId,
        position: firstPosition + 1,
        role: "assistant",
        content: response.content,
        groundingStatus: response.groundingStatus,
        sourceReferences: response.sources,
        model: response.model,
        promptVersion: response.promptVersion,
        generationRequestId: response.requestId,
        generationResponseId: response.responseId,
        usage: response.usage ?? undefined,
      },
    ]);
  });
  return loadConversationView(conversationId, revision + 1);
}

export async function resetCourseAiConversation(
  userId: string,
  courseId: string,
): Promise<CourseAiConversationView> {
  const conversationId = await db.transaction(async (tx) => {
    const [membership] = await tx
      .select({ userId: courseMemberships.userId })
      .from(courseMemberships)
      .where(
        and(
          eq(courseMemberships.userId, userId),
          eq(courseMemberships.courseId, courseId),
        ),
      )
      .limit(1);
    if (!membership)
      throw new CourseAiError("Course access denied.", "access_denied");
    await tx
      .delete(courseAiConversations)
      .where(
        and(
          eq(courseAiConversations.userId, userId),
          eq(courseAiConversations.courseId, courseId),
        ),
      );
    const [created] = await tx
      .insert(courseAiConversations)
      .values({ userId, courseId })
      .returning({ id: courseAiConversations.id });
    return created.id;
  });
  return { ...emptyConversationView(), id: conversationId };
}

function emptyConversationView(): CourseAiConversationView {
  return { id: null, revision: 0, messages: [], earlierMessagesOmitted: false };
}

async function hasCourseMembership(
  userId: string,
  courseId: string,
): Promise<boolean> {
  const [membership] = await db
    .select({ userId: courseMemberships.userId })
    .from(courseMemberships)
    .where(
      and(
        eq(courseMemberships.userId, userId),
        eq(courseMemberships.courseId, courseId),
      ),
    )
    .limit(1);
  return Boolean(membership);
}

async function findConversation(userId: string, courseId: string) {
  const [conversation] = await db
    .select({
      id: courseAiConversations.id,
      revision: courseAiConversations.revision,
    })
    .from(courseAiConversations)
    .where(
      and(
        eq(courseAiConversations.userId, userId),
        eq(courseAiConversations.courseId, courseId),
      ),
    )
    .limit(1);
  return conversation;
}

async function loadConversationView(
  conversationId: string,
  revision: number,
): Promise<CourseAiConversationView> {
  const rows = await db
    .select({
      id: courseAiMessages.id,
      role: courseAiMessages.role,
      content: courseAiMessages.content,
      groundingStatus: courseAiMessages.groundingStatus,
      sources: courseAiMessages.sourceReferences,
      createdAt: courseAiMessages.createdAt,
      position: courseAiMessages.position,
    })
    .from(courseAiMessages)
    .where(eq(courseAiMessages.conversationId, conversationId))
    .orderBy(desc(courseAiMessages.position))
    .limit(CHAT_DISPLAY_MESSAGE_LIMIT + 1);
  const earlierMessagesOmitted = rows.length > CHAT_DISPLAY_MESSAGE_LIMIT;
  const visible = rows
    .slice(0, CHAT_DISPLAY_MESSAGE_LIMIT)
    .sort((a, b) => a.position - b.position);
  return {
    id: conversationId,
    revision,
    earlierMessagesOmitted,
    messages: visible.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      groundingStatus: message.groundingStatus,
      sources: message.sources,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

function boundContext(
  rows: Array<{ role: "user" | "assistant"; content: string }>,
): ChatContextMessage[] {
  const completeRows = rows.length % 2 === 0 ? rows : rows.slice(1);
  let total = completeRows.reduce((sum, row) => sum + row.content.length, 0);
  let start = 0;
  while (
    total > CHAT_CONTEXT_CHARACTER_LIMIT &&
    start + 1 < completeRows.length
  ) {
    total -=
      completeRows[start].content.length +
      completeRows[start + 1].content.length;
    start += 2;
  }
  const retained = completeRows.slice(start);
  if (total <= CHAT_CONTEXT_CHARACTER_LIMIT) {
    return retained.map((row) => ({ ...row }));
  }
  const [user, assistant] = retained;
  return [
    { ...user, content: user.content.slice(0, 4_000) },
    { ...assistant, content: assistant.content.slice(0, 8_000) },
  ];
}
