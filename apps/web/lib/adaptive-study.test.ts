import { describe, expect, it } from "vitest";

import { deriveMasterySignal, recommendNextTopic } from "./adaptive-study";

describe("deriveMasterySignal", () => {
  it("normalizes scores and gives recent difficult evidence more weight", () => {
    expect(
      deriveMasterySignal([
        { score: 0.9, maximumScore: 1, difficulty: 0.9 },
        { score: 0.4, maximumScore: 1, difficulty: 0.3 },
      ]),
    ).toBeCloseTo(0.7026, 4);
  });

  it("uses at most the eight newest evidence records", () => {
    const evidence = [
      { score: 1, maximumScore: 1, difficulty: 0.5 },
      ...Array.from({ length: 8 }, () => ({
        score: 0,
        maximumScore: 1,
        difficulty: 0.5,
      })),
    ];
    expect(deriveMasterySignal(evidence)).toBeGreaterThan(0);
  });
});

describe("recommendNextTopic", () => {
  const base = {
    completed: false,
    lastStudiedAt: null,
    plannedFor: null,
  };

  it("prioritizes an overdue scheduled topic", () => {
    const result = recommendNextTopic(
      [
        { ...base, id: "weak", name: "Weak", position: 0, mastery: 0.1 },
        {
          ...base,
          id: "overdue",
          name: "Overdue",
          position: 1,
          mastery: 0.8,
          plannedFor: "2026-09-10",
        },
      ],
      null,
      new Date("2026-09-12T12:00:00Z"),
    );
    expect(result?.id).toBe("overdue");
    expect(result?.reason).toContain("overdue");
  });

  it("uses mastery need and deterministic position tie-breaking", () => {
    const result = recommendNextTopic(
      [
        { ...base, id: "later", name: "Later", position: 2, mastery: null },
        { ...base, id: "first", name: "First", position: 0, mastery: null },
      ],
      "2026-09-20",
      new Date("2026-09-12T12:00:00Z"),
    );
    expect(result?.id).toBe("first");
  });
});
