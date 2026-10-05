import { notFound } from "next/navigation";

import { getCourseForUser } from "@/lib/db/course-management";
import { getCourseAiConversationView } from "@/lib/db/course-ai";
import { listCourseMaterialsForUser } from "@/lib/db/material-management";
import { requireSession } from "@/lib/session";

import { CourseDetail } from "./course-detail";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const [{ courseId }, session] = await Promise.all([params, requireSession()]);
  const [course, materials, courseAiConversation] = await Promise.all([
    getCourseForUser(session.userId, courseId),
    listCourseMaterialsForUser(session.userId, courseId),
    getCourseAiConversationView(session.userId, courseId),
  ]);
  if (!course) notFound();
  if (!courseAiConversation) notFound();
  return (
    <CourseDetail
      course={course}
      courseAiConversation={courseAiConversation}
      materials={materials}
    />
  );
}
