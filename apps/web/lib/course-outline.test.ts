import { describe, expect, it } from "vitest";

import {
  CourseOutlineError,
  parseCourseOutline,
  serializeCourseOutline,
} from "./course-outline";

describe("course outline parsing", () => {
  it("parses bullets and indentation into exactly three hierarchy levels", () => {
    expect(
      parseCourseOutline(`Chapter 1: Probability Foundations
  - Sample Spaces
  - Conditional Probability
    - Bayes' Rule

Chapter 2: Random Variables
  * PMFs
  * CDFs`),
    ).toEqual([
      {
        name: "Chapter 1: Probability Foundations",
        children: [
          { name: "Sample Spaces", children: [] },
          {
            name: "Conditional Probability",
            children: [{ name: "Bayes' Rule", children: [] }],
          },
        ],
      },
      {
        name: "Chapter 2: Random Variables",
        children: [
          { name: "PMFs", children: [] },
          { name: "CDFs", children: [] },
        ],
      },
    ]);
  });

  it("serializes an existing hierarchy into the bulk editor format", () => {
    expect(
      serializeCourseOutline([
        {
          name: "Chapter 1",
          subtopics: [
            {
              name: "Vectors",
              subtopics: [{ name: "Dot products", subtopics: [] }],
            },
          ],
        },
      ]),
    ).toBe("Chapter 1\n  - Vectors\n    - Dot products");
  });

  it.each([
    ["  - Orphan", "must start at the top level"],
    ["Topic\n  - Child\n    - Grandchild\n      - Too deep", "deeper"],
    ["Topic\n    - Child\n  - Invalid dedent", "does not match"],
    ["A", "at least 2 characters"],
  ])("rejects malformed outline %j", (outline, message) => {
    expect(() => parseCourseOutline(outline)).toThrowError(new RegExp(message));
  });

  it("accepts an empty outline for course creation and confirmed clearing", () => {
    expect(parseCourseOutline("\n\n")).toEqual([]);
  });

  it("uses a dedicated validation error type", () => {
    expect(() => parseCourseOutline("  Invalid")).toThrow(CourseOutlineError);
  });
});
