import { describe, expect, it } from "vitest";

import {
  calculateProgress,
  isValidJoinCode,
  normalizeJoinCode,
} from "./courses";

describe("course helpers", () => {
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
