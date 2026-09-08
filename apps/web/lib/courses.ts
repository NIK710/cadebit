export type Subtopic = {
  id: string;
  name: string;
  completed: boolean;
};

export type CourseTopic = {
  id: string;
  name: string;
  subtopics: Subtopic[];
};

export type Course = {
  id: string;
  name: string;
  description: string;
  role: "Admin" | "Member";
  targetDate: string;
  topics: CourseTopic[];
};

export type NewCourseInput = {
  name: string;
  description: string;
  targetDate: string;
  topicOutline: string;
};

export const sampleCourses: Course[] = [
  {
    id: "ece-313",
    name: "ECE 313",
    description: "Probability with engineering applications.",
    role: "Admin",
    targetDate: "2026-12-14",
    topics: [
      {
        id: "probability-foundations",
        name: "Probability Foundations",
        subtopics: [
          { id: "sample-spaces", name: "Sample Spaces", completed: true },
          {
            id: "conditional-probability",
            name: "Conditional Probability",
            completed: false,
          },
          { id: "bayes-rule", name: "Bayes' Rule", completed: false },
        ],
      },
      {
        id: "random-variables",
        name: "Random Variables",
        subtopics: [
          { id: "pmfs", name: "PMFs", completed: true },
          { id: "pdfs", name: "PDFs", completed: false },
          { id: "cdfs", name: "CDFs", completed: false },
        ],
      },
    ],
  },
  {
    id: "cs-225",
    name: "CS 225",
    description: "Data structures and software development principles.",
    role: "Member",
    targetDate: "2026-12-18",
    topics: [
      {
        id: "trees",
        name: "Trees",
        subtopics: [
          { id: "binary-trees", name: "Binary Trees", completed: true },
          { id: "heaps", name: "Heaps", completed: true },
          { id: "balanced-trees", name: "Balanced Trees", completed: false },
        ],
      },
    ],
  },
];

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "course"
  );
}

export function parseTopicOutline(outline: string): CourseTopic[] {
  const topics = new Map<string, CourseTopic>();

  for (const line of outline.split("\n")) {
    const [topicName, subtopicName] = line
      .split(">", 2)
      .map((part) => part.trim());
    if (!topicName) continue;

    const topicId = slugify(topicName);
    const topic = topics.get(topicId) ?? {
      id: topicId,
      name: topicName,
      subtopics: [],
    };

    if (subtopicName) {
      const subtopicId = slugify(`${topicName}-${subtopicName}`);
      if (!topic.subtopics.some((subtopic) => subtopic.id === subtopicId)) {
        topic.subtopics.push({
          id: subtopicId,
          name: subtopicName,
          completed: false,
        });
      }
    }

    topics.set(topicId, topic);
  }

  return [...topics.values()];
}

export function createCourseRecord(
  input: NewCourseInput,
  uniqueId: string,
): Course {
  return {
    id: `${slugify(input.name)}-${uniqueId.slice(0, 8)}`,
    name: input.name.trim(),
    description: input.description.trim(),
    role: "Admin",
    targetDate: input.targetDate,
    topics: parseTopicOutline(input.topicOutline),
  };
}

export function getCourseProgress(course: Course): number {
  const subtopics = course.topics.flatMap((topic) => topic.subtopics);
  if (subtopics.length === 0) return 0;

  const completed = subtopics.filter((subtopic) => subtopic.completed).length;
  return Math.round((completed / subtopics.length) * 100);
}

export function parseStoredCourses(value: string | null): Course[] | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.every(isCourse)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isCourse(value: unknown): value is Course {
  if (!value || typeof value !== "object") return false;
  const course = value as Partial<Course>;

  return (
    typeof course.id === "string" &&
    typeof course.name === "string" &&
    typeof course.description === "string" &&
    (course.role === "Admin" || course.role === "Member") &&
    typeof course.targetDate === "string" &&
    Array.isArray(course.topics) &&
    course.topics.every(isCourseTopic)
  );
}

function isCourseTopic(value: unknown): value is CourseTopic {
  if (!value || typeof value !== "object") return false;
  const topic = value as Partial<CourseTopic>;

  return (
    typeof topic.id === "string" &&
    typeof topic.name === "string" &&
    Array.isArray(topic.subtopics) &&
    topic.subtopics.every(isSubtopic)
  );
}

function isSubtopic(value: unknown): value is Subtopic {
  if (!value || typeof value !== "object") return false;
  const subtopic = value as Partial<Subtopic>;

  return (
    typeof subtopic.id === "string" &&
    typeof subtopic.name === "string" &&
    typeof subtopic.completed === "boolean"
  );
}
