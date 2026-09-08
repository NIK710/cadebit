"use client";

import Link from "next/link";

import { getCourseProgress } from "@/lib/courses";

import { useCourses } from "../course-provider";

export default function DashboardPage() {
  const { courses, ready } = useCourses();

  if (!ready)
    return <p className="text-sm text-zinc-600">Loading dashboard…</p>;

  const averageProgress = courses.length
    ? Math.round(
        courses.reduce(
          (total, course) => total + getCourseProgress(course),
          0,
        ) / courses.length,
      )
    : 0;
  const nextCourse = courses.find((course) => getCourseProgress(course) < 100);
  const nextSubtopic = nextCourse?.topics
    .flatMap((topic) => topic.subtopics)
    .find((subtopic) => !subtopic.completed);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-600">Your study overview</p>
          <h1 className="mt-1 text-3xl font-semibold">Dashboard</h1>
        </div>
        <Link
          className="border border-black bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          href="/courses/new"
        >
          Create course
        </Link>
      </header>

      <section
        className="grid gap-4 sm:grid-cols-3"
        aria-label="Learning summary"
      >
        <SummaryCard label="Courses" value={String(courses.length)} />
        <SummaryCard label="Average progress" value={`${averageProgress}%`} />
        <SummaryCard label="Current streak" value="1 day" />
      </section>

      <section className="border border-black p-5">
        <p className="text-sm font-medium text-zinc-600">
          Recommended next action
        </p>
        {nextCourse && nextSubtopic ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">
                Review {nextSubtopic.name}
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Continue {nextCourse.name}.
              </p>
            </div>
            <Link
              className="border border-black px-4 py-2 text-sm font-medium hover:bg-zinc-100"
              href={`/courses/${nextCourse.id}`}
            >
              Open course
            </Link>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-600">
            Create a course to receive a study recommendation.
          </p>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Current courses</h2>
          <Link
            className="text-sm underline underline-offset-4"
            href="/courses"
          >
            View all
          </Link>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {courses.slice(0, 4).map((course) => {
            const progress = getCourseProgress(course);
            return (
              <Link
                className="border border-black p-5 hover:bg-zinc-50"
                href={`/courses/${course.id}`}
                key={course.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">{course.name}</h3>
                    <p className="mt-1 text-sm text-zinc-600">
                      {course.description}
                    </p>
                  </div>
                  <span className="text-sm font-medium">{progress}%</span>
                </div>
                <div
                  className="mt-4 h-2 border border-black"
                  aria-hidden="true"
                >
                  <div
                    className="h-full bg-black"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-black p-5">
      <p className="text-sm text-zinc-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
