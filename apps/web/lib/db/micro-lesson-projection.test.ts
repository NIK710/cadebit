import { describe, expect, it } from "vitest";

import type { MicroLessonBlock } from "../ai-service";
import { projectMicroLesson } from "./adaptive-study";

const blocks: MicroLessonBlock[] = [
  { id: "teach", type: "explanation", heading: null, body: "Instruction" },
  {
    id: "check-1",
    type: "mcq",
    prompt: "First question",
    choices: [
      { id: "a", text: "A", feedback: "A feedback", misconception: null },
      {
        id: "b",
        text: "B",
        feedback: "B feedback",
        misconception: "B mistake",
      },
      { id: "c", text: "C", feedback: "C feedback", misconception: null },
      { id: "d", text: "D", feedback: "D feedback", misconception: null },
    ],
    correctChoiceId: "a",
    explanation: "Private explanation",
    difficulty: 0.5,
  },
  { id: "extend", type: "explanation", heading: null, body: "Extension" },
  {
    id: "check-2",
    type: "mcq",
    prompt: "Second question",
    choices: [
      { id: "a", text: "A2", feedback: "A2 feedback", misconception: null },
      { id: "b", text: "B2", feedback: "B2 feedback", misconception: null },
      { id: "c", text: "C2", feedback: "C2 feedback", misconception: null },
      { id: "d", text: "D2", feedback: "D2 feedback", misconception: null },
    ],
    correctChoiceId: "d",
    explanation: "Second private explanation",
    difficulty: 0.7,
  },
];

describe("projectMicroLesson", () => {
  it("stops at the unanswered MCQ without exposing private grading data", () => {
    const result = projectMicroLesson(blocks, []);
    expect(result.blocks).toHaveLength(2);
    expect(result.complete).toBe(false);
    expect(result.blocks[1]).toEqual({
      id: "check-1",
      type: "mcq",
      prompt: "First question",
      choices: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
        { id: "c", text: "C" },
        { id: "d", text: "D" },
      ],
      result: null,
    });
    expect(JSON.stringify(result)).not.toContain("Private explanation");
    expect(JSON.stringify(result)).not.toContain("feedback");
    expect(JSON.stringify(result)).not.toContain("B mistake");
  });

  it("reveals only selected feedback and continues inline to the next MCQ", () => {
    const result = projectMicroLesson(blocks, [
      { blockId: "check-1", selectedChoiceId: "b", correct: false },
    ]);
    expect(result.blocks).toHaveLength(4);
    expect(result.blocks[1]).toMatchObject({
      result: {
        selectedChoiceId: "b",
        correct: false,
        selectedFeedback: "B feedback",
        misconception: "B mistake",
        explanation: "Private explanation",
      },
    });
    expect(JSON.stringify(result)).not.toContain("A feedback");
    expect(result.blocks[3]).toMatchObject({ result: null });
  });
});
