import { CourseDetail } from "./course-detail";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  return <CourseDetail courseId={courseId} />;
}
