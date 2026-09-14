import "server-only";

import { serverEnvironment } from "./environment";

export type GenerationTask = "answer" | "explain" | "summarize" | "quiz";

export interface GenerateCourseContentRequest {
  userId: string;
  courseId: string;
  topicId?: string;
  task: GenerationTask;
  input: string;
}

export interface SourceReference {
  materialId: string;
  materialTitle: string;
  chunkId: string | null;
  pageNumber: number | null;
  section: string | null;
  excerpt: string | null;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface GenerateCourseContentResponse {
  requestId: string;
  responseId: string;
  task: GenerationTask;
  content: string;
  sources: SourceReference[];
  model: string;
  usage: TokenUsage | null;
}

export interface GeneratePracticeQuestionRequest {
  userId: string;
  courseId: string;
  topicId: string;
  difficulty: number;
}

export interface GeneratedPracticeQuestion {
  requestId: string;
  responseId: string;
  question: string;
  referenceAnswer: string;
  gradingRubric: string;
  difficulty: number;
  sources: SourceReference[];
  model: string;
  promptVersion: string;
  usage: TokenUsage | null;
}

export interface GradePracticeAnswerRequest {
  userId: string;
  courseId: string;
  topicId: string;
  question: string;
  referenceAnswer: string;
  gradingRubric: string;
  studentAnswer: string;
  difficulty: number;
}

export interface GradedPracticeAnswer {
  requestId: string;
  responseId: string;
  score: number;
  correct: boolean;
  feedback: string;
  strengths: string[];
  gaps: string[];
  model: string;
  promptVersion: string;
  usage: TokenUsage | null;
}

export class AiServiceError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly requestId: string | null,
  ) {
    super(message);
    this.name = "AiServiceError";
  }
}

interface AiServiceClientOptions {
  fetchImplementation?: typeof fetch;
  serviceUrl?: string;
  serviceToken?: string | null;
  timeoutMs?: number;
}

export async function generateCourseContent(
  request: GenerateCourseContentRequest,
  options: AiServiceClientOptions = {},
): Promise<GenerateCourseContentResponse> {
  const serviceToken = options.serviceToken ?? serverEnvironment.aiServiceToken;
  if (!serviceToken) {
    throw new AiServiceError(
      "AI_SERVICE_TOKEN is not configured.",
      "service_configuration_error",
      503,
      null,
    );
  }

  const fetchImplementation = options.fetchImplementation ?? fetch;
  const serviceUrl = options.serviceUrl ?? serverEnvironment.aiServiceUrl;
  const timeoutMs = options.timeoutMs ?? serverEnvironment.aiServiceTimeoutMs;

  let response: Response;
  try {
    response = await fetchImplementation(`${serviceUrl}/v1/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: request.userId,
        course_id: request.courseId,
        topic_id: request.topicId,
        task: request.task,
        input: request.input,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut =
      error instanceof DOMException && error.name === "TimeoutError";
    throw new AiServiceError(
      timedOut
        ? "The AI service request timed out."
        : "The AI service is unavailable.",
      timedOut ? "ai_service_timeout" : "ai_service_unavailable",
      timedOut ? 504 : 503,
      null,
    );
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = readErrorDetail(payload);
    throw new AiServiceError(
      detail?.message ?? "The AI service could not complete the request.",
      detail?.code ?? "ai_service_error",
      response.status,
      detail?.request_id ?? response.headers.get("X-Request-ID"),
    );
  }

  return parseGenerateResponse(payload);
}

export async function generatePracticeQuestion(
  request: GeneratePracticeQuestionRequest,
  options: AiServiceClientOptions = {},
): Promise<GeneratedPracticeQuestion> {
  const payload = await postAiService(
    "/v1/practice/questions",
    {
      user_id: request.userId,
      course_id: request.courseId,
      topic_id: request.topicId,
      difficulty: request.difficulty,
    },
    options,
  );
  if (
    !isRecord(payload) ||
    typeof payload.request_id !== "string" ||
    typeof payload.response_id !== "string" ||
    typeof payload.question !== "string" ||
    typeof payload.reference_answer !== "string" ||
    typeof payload.grading_rubric !== "string" ||
    typeof payload.difficulty !== "number" ||
    !Array.isArray(payload.sources) ||
    typeof payload.model !== "string" ||
    typeof payload.prompt_version !== "string"
  ) {
    throwInvalidResponse();
  }
  return {
    requestId: payload.request_id,
    responseId: payload.response_id,
    question: payload.question,
    referenceAnswer: payload.reference_answer,
    gradingRubric: payload.grading_rubric,
    difficulty: payload.difficulty,
    sources: payload.sources.map(parseSourceReference),
    model: payload.model,
    promptVersion: payload.prompt_version,
    usage: payload.usage === null ? null : parseTokenUsage(payload.usage),
  };
}

export async function gradePracticeAnswer(
  request: GradePracticeAnswerRequest,
  options: AiServiceClientOptions = {},
): Promise<GradedPracticeAnswer> {
  const payload = await postAiService(
    "/v1/practice/grade",
    {
      user_id: request.userId,
      course_id: request.courseId,
      topic_id: request.topicId,
      question: request.question,
      reference_answer: request.referenceAnswer,
      grading_rubric: request.gradingRubric,
      student_answer: request.studentAnswer,
      difficulty: request.difficulty,
    },
    options,
  );
  if (
    !isRecord(payload) ||
    typeof payload.request_id !== "string" ||
    typeof payload.response_id !== "string" ||
    typeof payload.score !== "number" ||
    typeof payload.correct !== "boolean" ||
    typeof payload.feedback !== "string" ||
    !isStringArray(payload.strengths) ||
    !isStringArray(payload.gaps) ||
    typeof payload.model !== "string" ||
    typeof payload.prompt_version !== "string"
  ) {
    throwInvalidResponse();
  }
  return {
    requestId: payload.request_id,
    responseId: payload.response_id,
    score: payload.score,
    correct: payload.correct,
    feedback: payload.feedback,
    strengths: payload.strengths,
    gaps: payload.gaps,
    model: payload.model,
    promptVersion: payload.prompt_version,
    usage: payload.usage === null ? null : parseTokenUsage(payload.usage),
  };
}

async function postAiService(
  path: string,
  body: Record<string, unknown>,
  options: AiServiceClientOptions,
): Promise<unknown> {
  const serviceToken = options.serviceToken ?? serverEnvironment.aiServiceToken;
  if (!serviceToken) {
    throw new AiServiceError(
      "AI_SERVICE_TOKEN is not configured.",
      "service_configuration_error",
      503,
      null,
    );
  }
  let response: Response;
  try {
    response = await (options.fetchImplementation ?? fetch)(
      `${options.serviceUrl ?? serverEnvironment.aiServiceUrl}${path}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(
          options.timeoutMs ?? serverEnvironment.aiServiceTimeoutMs,
        ),
      },
    );
  } catch (error) {
    const timedOut =
      error instanceof DOMException && error.name === "TimeoutError";
    throw new AiServiceError(
      timedOut
        ? "The AI service request timed out."
        : "The AI service is unavailable.",
      timedOut ? "ai_service_timeout" : "ai_service_unavailable",
      timedOut ? 504 : 503,
      null,
    );
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = readErrorDetail(payload);
    throw new AiServiceError(
      detail?.message ?? "The AI service could not complete the request.",
      detail?.code ?? "ai_service_error",
      response.status,
      detail?.request_id ?? response.headers.get("X-Request-ID"),
    );
  }
  return payload;
}

function readErrorDetail(
  value: unknown,
): { code: string; message: string; request_id?: string } | null {
  if (!isRecord(value) || !isRecord(value.error)) {
    return null;
  }
  const detail = value.error;
  if (typeof detail.code !== "string" || typeof detail.message !== "string") {
    return null;
  }
  return {
    code: detail.code,
    message: detail.message,
    request_id:
      typeof detail.request_id === "string" ? detail.request_id : undefined,
  };
}

function parseGenerateResponse(value: unknown): GenerateCourseContentResponse {
  if (
    !isRecord(value) ||
    typeof value.request_id !== "string" ||
    typeof value.response_id !== "string" ||
    !isGenerationTask(value.task) ||
    typeof value.content !== "string" ||
    !Array.isArray(value.sources) ||
    typeof value.model !== "string"
  ) {
    throw new AiServiceError(
      "The AI service returned an invalid response.",
      "invalid_ai_service_response",
      502,
      null,
    );
  }

  return {
    requestId: value.request_id,
    responseId: value.response_id,
    task: value.task,
    content: value.content,
    sources: value.sources.map(parseSourceReference),
    model: value.model,
    usage: value.usage === null ? null : parseTokenUsage(value.usage),
  };
}

function parseSourceReference(value: unknown): SourceReference {
  if (
    !isRecord(value) ||
    typeof value.material_id !== "string" ||
    typeof value.material_title !== "string"
  ) {
    throw new AiServiceError(
      "The AI service returned an invalid source reference.",
      "invalid_ai_service_response",
      502,
      null,
    );
  }
  return {
    materialId: value.material_id,
    materialTitle: value.material_title,
    chunkId: nullableString(value.chunk_id),
    pageNumber: nullableNumber(value.page_number),
    section: nullableString(value.section),
    excerpt: nullableString(value.excerpt),
  };
}

function parseTokenUsage(value: unknown): TokenUsage {
  if (
    !isRecord(value) ||
    typeof value.input_tokens !== "number" ||
    typeof value.output_tokens !== "number" ||
    typeof value.total_tokens !== "number"
  ) {
    throw new AiServiceError(
      "The AI service returned invalid token usage.",
      "invalid_ai_service_response",
      502,
      null,
    );
  }
  return {
    inputTokens: value.input_tokens,
    outputTokens: value.output_tokens,
    totalTokens: value.total_tokens,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGenerationTask(value: unknown): value is GenerationTask {
  return ["answer", "explain", "summarize", "quiz"].includes(String(value));
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  throwInvalidResponse();
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  throwInvalidResponse();
}

function throwInvalidResponse(): never {
  throw new AiServiceError(
    "The AI service returned an invalid response.",
    "invalid_ai_service_response",
    502,
    null,
  );
}
