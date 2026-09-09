import { notFound } from "next/navigation";

import { getCourseForUser } from "@/lib/db/course-management";
import { requireSession } from "@/lib/session";

import { CourseDetail } from "./course-detail";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const [{ courseId }, session] = await Promise.all([params, requireSession()]);
  const course = await getCourseForUser(session.userId, courseId);
  if (!course) notFound();
  return <CourseDetail course={course} />;
}
