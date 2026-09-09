import { describe, expect, it } from "vitest";

import {
  calculateProgress,
  isValidJoinCode,
  normalizeJoinCode,
  parseTopicOutline,
} from "./courses";

describe("course helpers", () => {
  it("parses and deduplicates a topic outline", () => {
    const topics = parseTopicOutline(
      "Probability > Sample Spaces\nProbability > Bayes' Rule\nprobability > sample spaces\nRandom Variables > PMFs",
    );

    expect(topics).toEqual([
      {
        name: "Probability",
        subtopics: ["Sample Spaces", "Bayes' Rule"],
      },
      { name: "Random Variables", subtopics: ["PMFs"] },
    ]);
  });

  it("normalizes and validates six-character join codes", () => {
    expect(normalizeJoinCode(" ab2-3cd ")).toBe("AB23CD");
    expect(isValidJoinCode("AB23CD")).toBe(true);
    expect(isValidJoinCode("O12345")).toBe(false);
    expect(isValidJoinCode("ABC12")).toBe(false);
  });

  it("derives progress from completed topic records", () => {
    expect(calculateProgress(1, 2)).toBe(50);
    expect(calculateProgress(0, 0)).toBe(0);
  });
});
