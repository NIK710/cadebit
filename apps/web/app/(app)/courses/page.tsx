import Link from "next/link";

import { formatCourseDate } from "@/lib/courses";
import { listCoursesForUser } from "@/lib/db/course-management";
import { requireSession } from "@/lib/session";

import { JoinCourseForm } from "./join-course-form";

export default async function CoursesPage() {
  const session = await requireSession();
  const courses = await listCoursesForUser(session.userId);

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-600">
            Shared and independent study spaces
          </p>
          <h1 className="mt-1 text-3xl font-semibold">Courses</h1>
        </div>
        <Link
          className="border border-black bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          href="/courses/new"
        >
          New course
        </Link>
      </header>

      <JoinCourseForm />

      {courses.length === 0 ? (
        <section className="border border-black p-8 text-center">
          <h2 className="text-lg font-semibold">No courses yet</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Create a course or join a shared course to begin.
          </p>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {courses.map((course) => (
          <article className="border border-black p-5" key={course.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">
                  {course.type} · {course.role}
                </span>
                <h2 className="mt-1 text-xl font-semibold">{course.name}</h2>
              </div>
              <span className="text-sm font-medium">{course.progress}%</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              {course.description || "No description yet."}
            </p>
            <div className="mt-4 h-2 border border-black" aria-hidden="true">
              <div
                className="h-full bg-black"
                style={{ width: `${course.progress}%` }}
              />
            </div>
            <div className="mt-5 flex items-center justify-between gap-4 border-t border-zinc-300 pt-4 text-sm">
              <span>Target: {formatCourseDate(course.targetDate)}</span>
              <Link
                className="font-medium underline underline-offset-4"
                href={`/courses/${course.id}`}
              >
                Open
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
