"use client";

import Link from "next/link";

import { getCourseProgress } from "@/lib/courses";

import { useCourses } from "../../course-provider";

export function CourseDetail({ courseId }: { courseId: string }) {
  const { courses, ready } = useCourses();
  const course = courses.find((candidate) => candidate.id === courseId);

  if (!ready) return <p className="text-sm text-zinc-600">Loading course…</p>;

  if (!course) {
    return (
      <section className="border border-black p-8">
        <h1 className="text-2xl font-semibold">Course not found</h1>
        <p className="mt-2 text-sm text-zinc-600">
          This course may belong to a different local account or browser.
        </p>
        <Link
          className="mt-5 inline-block border border-black px-4 py-2 text-sm font-medium hover:bg-zinc-100"
          href="/courses"
        >
          Back to courses
        </Link>
      </section>
    );
  }

  const progress = getCourseProgress(course);

  return (
    <div className="space-y-8">
      <header>
        <Link className="text-sm underline underline-offset-4" href="/courses">
          ← Courses
        </Link>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-600">{course.role}</p>
            <h1 className="mt-1 text-3xl font-semibold">{course.name}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              {course.description || "No description yet."}
            </p>
          </div>
          <div className="border border-black px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-wide text-zinc-600">
              Progress
            </p>
            <p className="mt-1 text-2xl font-semibold">{progress}%</p>
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <InfoCard label="Target date" value={formatDate(course.targetDate)} />
        <InfoCard label="Topics" value={String(course.topics.length)} />
      </section>

      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-600">Course structure</p>
            <h2 className="mt-1 text-2xl font-semibold">
              Topics and subtopics
            </h2>
          </div>
          {course.role === "Admin" ? (
            <span className="text-xs text-zinc-600">
              Editing arrives with Phase 3
            </span>
          ) : null}
        </div>

        {course.topics.length === 0 ? (
          <p className="mt-4 border border-black p-5 text-sm text-zinc-600">
            No topics have been added yet.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {course.topics.map((topic) => (
              <article className="border border-black" key={topic.id}>
                <h3 className="border-b border-black bg-zinc-100 px-4 py-3 font-semibold">
                  {topic.name}
                </h3>
                {topic.subtopics.length ? (
                  <ul className="divide-y divide-zinc-300">
                    {topic.subtopics.map((subtopic) => (
                      <li
                        className="flex items-center justify-between gap-4 px-4 py-3"
                        key={subtopic.id}
                      >
                        <span>{subtopic.name}</span>
                        <span className="text-xs text-zinc-600">
                          {subtopic.completed ? "Completed" : "Not completed"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-3 text-sm text-zinc-600">
                    No subtopics yet.
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-black p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-600">{label}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}

function formatDate(value: string): string {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
