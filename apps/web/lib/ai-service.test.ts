import { describe, expect, it, vi } from "vitest";

import {
  AiServiceError,
  generateCourseContent,
  generatePracticeQuestion,
  gradePracticeAnswer,
} from "./ai-service";

const request = {
  userId: "user-1",
  courseId: "4de11dff-5831-4113-8c63-51e4ad8bb7a2",
  task: "answer" as const,
  input: "What is a closure?",
};

describe("generateCourseContent", () => {
  it("sends the internal contract and maps structured source references", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          request_id: "request-1",
          response_id: "response-1",
          task: "answer",
          content: "A closure retains its lexical environment.",
          sources: [
            {
              material_id: "86a9168a-6a1d-4d63-b77f-f1582fe67346",
              material_title: "Lecture 3",
              chunk_id: "1c4cc166-2ca4-430e-a51c-84380980df57",
              page_number: 4,
              section: "Closures",
              excerpt: "A closure retains its lexical environment.",
            },
          ],
          model: "gpt-5.6-luna",
          usage: { input_tokens: 10, output_tokens: 8, total_tokens: 18 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await generateCourseContent(request, {
      fetchImplementation,
      serviceUrl: "http://ai:8000",
      serviceToken: "secret",
    });

    expect(fetchImplementation).toHaveBeenCalledWith(
      "http://ai:8000/v1/generate",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: request.userId,
          course_id: request.courseId,
          task: request.task,
          input: request.input,
        }),
      }),
    );
    expect(result.sources[0]).toEqual({
      materialId: "86a9168a-6a1d-4d63-b77f-f1582fe67346",
      materialTitle: "Lecture 3",
      chunkId: "1c4cc166-2ca4-430e-a51c-84380980df57",
      pageNumber: 4,
      section: "Closures",
      excerpt: "A closure retains its lexical environment.",
    });
    expect(result.usage?.totalTokens).toBe(18);
  });

  it("preserves structured service errors", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "course_access_denied",
            message: "The user cannot access this course.",
            request_id: "request-2",
          },
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(
      generateCourseContent(request, {
        fetchImplementation,
        serviceToken: "secret",
      }),
    ).rejects.toMatchObject({
      code: "course_access_denied",
      status: 403,
      requestId: "request-2",
    });
  });

  it("maps request timeouts", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new DOMException("timed out", "TimeoutError"));

    await expect(
      generateCourseContent(request, {
        fetchImplementation,
        serviceToken: "secret",
      }),
    ).rejects.toMatchObject({
      code: "ai_service_timeout",
      status: 504,
    });
  });

  it("rejects a malformed successful response", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ content: "missing fields" })),
      );

    await expect(
      generateCourseContent(request, {
        fetchImplementation,
        serviceToken: "secret",
      }),
    ).rejects.toBeInstanceOf(AiServiceError);
  });
});

describe("adaptive practice contracts", () => {
  it("maps a structured grounded question including server-only rubric data", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        request_id: "request-3",
        response_id: "response-3",
        question: "Explain lexical capture.",
        reference_answer: "A closure retains bindings from its defining scope.",
        grading_rubric:
          "Full credit identifies definition scope and retained bindings.",
        difficulty: 0.6,
        sources: [],
        model: "gpt-5.6-luna",
        prompt_version: "practice-question-v1",
        usage: null,
      }),
    );

    const result = await generatePracticeQuestion(
      {
        userId: "user-1",
        courseId: request.courseId,
        topicId: "a0efffca-6c1a-4c86-97da-68771f2bdf13",
        difficulty: 0.6,
      },
      { fetchImplementation, serviceToken: "secret" },
    );

    expect(result.gradingRubric).toContain("Full credit");
    expect(fetchImplementation).toHaveBeenCalledWith(
      expect.stringContaining("/v1/practice/questions"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("maps normalized structured grading", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        request_id: "request-4",
        response_id: "response-4",
        score: 0.75,
        correct: false,
        feedback: "Good core idea; identify the defining scope.",
        strengths: ["Retained bindings"],
        gaps: ["Defining scope"],
        model: "gpt-5.6-luna",
        prompt_version: "practice-grading-v1",
        usage: null,
      }),
    );
    const result = await gradePracticeAnswer(
      {
        userId: "user-1",
        courseId: request.courseId,
        topicId: "a0efffca-6c1a-4c86-97da-68771f2bdf13",
        question: "Explain lexical capture.",
        referenceAnswer: "Reference",
        gradingRubric: "Rubric",
        studentAnswer: "Answer",
        difficulty: 0.6,
      },
      { fetchImplementation, serviceToken: "secret" },
    );
    expect(result).toMatchObject({ score: 0.75, correct: false });
  });
});
