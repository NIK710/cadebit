export const JOIN_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

export type CourseListItem = {
  id: string;
  name: string;
  description: string;
  type: "shared" | "independent";
  role: "admin" | "member";
  targetDate: string | null;
  completedTopics: number;
  topicCount: number;
  progress: number;
};

export type CourseTopic = {
  id: string;
  name: string;
  description: string;
  position: number;
  completed: boolean;
  confidence: number | null;
  subtopics: CourseTopic[];
};

export type CourseDetail = CourseListItem & {
  joinCode: string | null;
  topics: CourseTopic[];
  totalStudySeconds: number;
};

export function normalizeJoinCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidJoinCode(value: string): boolean {
  return JOIN_CODE_PATTERN.test(normalizeJoinCode(value));
}

export function calculateProgress(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

export function formatCourseDate(value: string | null): string {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
