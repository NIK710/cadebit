import { describe, expect, it } from "vitest";

import {
  createCourseRecord,
  getCourseProgress,
  parseStoredCourses,
  parseTopicOutline,
} from "./courses";

describe("course helpers", () => {
  it("parses a topic and subtopic outline", () => {
    const topics = parseTopicOutline(
      "Probability > Sample Spaces\nProbability > Bayes' Rule\nRandom Variables > PMFs",
    );

    expect(topics).toHaveLength(2);
    expect(topics[0].subtopics.map((subtopic) => subtopic.name)).toEqual([
      "Sample Spaces",
      "Bayes' Rule",
    ]);
  });

  it("creates an admin-owned independent course", () => {
    const course = createCourseRecord(
      {
        name: " Linear Algebra ",
        description: " Vectors and matrices ",
        targetDate: "2026-12-10",
        topicOutline: "Vectors > Basis",
      },
      "12345678-abcd",
    );

    expect(course.id).toBe("linear-algebra-12345678");
    expect(course.name).toBe("Linear Algebra");
    expect(course.role).toBe("Admin");
  });

  it("derives progress from subtopic completion", () => {
    const course = createCourseRecord(
      {
        name: "Test course",
        description: "",
        targetDate: "",
        topicOutline: "Topic > One\nTopic > Two",
      },
      "progress",
    );
    course.topics[0].subtopics[0].completed = true;

    expect(getCourseProgress(course)).toBe(50);
  });

  it("rejects malformed browser data", () => {
    expect(parseStoredCourses('{"unexpected":true}')).toBeNull();
    expect(parseStoredCourses("not-json")).toBeNull();
  });
});
