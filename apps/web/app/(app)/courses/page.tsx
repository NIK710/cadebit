"use client";

import Link from "next/link";

import { getCourseProgress } from "@/lib/courses";

import { useCourses } from "../course-provider";

export default function CoursesPage() {
  const { courses, ready } = useCourses();

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

      {!ready ? (
        <p className="text-sm text-zinc-600">Loading courses…</p>
      ) : null}

      {ready && courses.length === 0 ? (
        <section className="border border-black p-8 text-center">
          <h2 className="text-lg font-semibold">No courses yet</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Create an independent course to start organizing your material.
          </p>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {courses.map((course) => {
          const progress = getCourseProgress(course);
          return (
            <article className="border border-black p-5" key={course.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">
                    {course.role}
                  </span>
                  <h2 className="mt-1 text-xl font-semibold">{course.name}</h2>
                </div>
                <span className="text-sm font-medium">{progress}%</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                {course.description}
              </p>
              <div className="mt-4 h-2 border border-black" aria-hidden="true">
                <div
                  className="h-full bg-black"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-5 flex items-center justify-between gap-4 border-t border-zinc-300 pt-4 text-sm">
                <span>Target: {formatDate(course.targetDate)}</span>
                <Link
                  className="font-medium underline underline-offset-4"
                  href={`/courses/${course.id}`}
                >
                  Open
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      <p className="border border-dashed border-zinc-500 p-3 text-xs text-zinc-600">
        Course changes remain in this browser until Phase 3 connects these
        screens to the Phase 2 PostgreSQL model.
      </p>
    </div>
  );
}

function formatDate(value: string): string {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
