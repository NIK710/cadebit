"use client";

import Link from "next/link";
import { useActionState, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import {
  formatCourseDate,
  type CourseDetail as CourseDetailData,
  type CourseTopic,
} from "@/lib/courses";
import type { CourseMaterialSummary } from "@/lib/db/material-management";

import {
  addTopicAction,
  deleteTopicAction,
  generateCourseAiAction,
  renameTopicAction,
  updateCompletionAction,
  updateConfidenceAction,
  updateTargetDateAction,
  uploadCourseMaterialAction,
  type CourseActionState,
  type CourseAiActionState,
} from "../actions";

export function CourseDetail({
  course,
  materials,
}: {
  course: CourseDetailData;
  materials: CourseMaterialSummary[];
}) {
  const isAdmin = course.role === "admin";

  return (
    <div className="space-y-8">
      <header>
        <Link className="text-sm underline underline-offset-4" href="/courses">
          ← Courses
        </Link>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase text-zinc-600">
              {course.type} · {course.role}
            </p>
            <h1 className="mt-1 text-3xl font-semibold">{course.name}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              {course.description || "No description yet."}
            </p>
          </div>
          <div className="border border-black px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-wide text-zinc-600">
              Progress
            </p>
            <p className="mt-1 text-2xl font-semibold">{course.progress}%</p>
          </div>
        </div>
      </header>

      {isAdmin && course.joinCode ? (
        <section className="border border-black bg-zinc-100 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-600">
            Student join code
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.3em]">
            {course.joinCode}
          </p>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <InfoCard
          label="Target date"
          value={formatCourseDate(course.targetDate)}
        />
        <InfoCard
          label="Topics completed"
          value={`${course.completedTopics} / ${course.topicCount}`}
        />
        <InfoCard
          label="Study time"
          value={`${Math.round(course.totalStudySeconds / 60)} minutes`}
        />
      </section>

      <section className="max-w-xl">
        <TargetDateForm courseId={course.id} targetDate={course.targetDate} />
      </section>

      <section>
        <div>
          <p className="text-sm text-zinc-600">Course knowledge</p>
          <h2 className="mt-1 text-2xl font-semibold">Materials</h2>
        </div>
        {isAdmin ? <MaterialUploadForm courseId={course.id} /> : null}
        {materials.length === 0 ? (
          <p className="mt-4 border border-black p-5 text-sm text-zinc-600">
            No course materials have been uploaded.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-zinc-300 border border-black">
            {materials.map((material) => (
              <article
                className="flex flex-wrap items-center justify-between gap-3 p-4"
                key={material.id}
              >
                <div>
                  <h3 className="font-semibold">{material.title}</h3>
                  <p className="text-xs text-zinc-600">
                    {material.originalFilename} ·{" "}
                    {formatFileSize(material.byteSize)}
                  </p>
                  {material.failureReason ? (
                    <p className="mt-1 text-xs" role="alert">
                      {material.failureReason}
                    </p>
                  ) : null}
                </div>
                <span className="border border-black px-2 py-1 text-xs uppercase">
                  {material.status}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>

      <CourseAiPanel course={course} />

      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-600">Course structure</p>
            <h2 className="mt-1 text-2xl font-semibold">
              Topics and subtopics
            </h2>
          </div>
          <span className="text-xs text-zinc-600">
            {isAdmin
              ? "Admins edit the shared structure."
              : "Only admins can edit the shared structure."}
          </span>
        </div>

        {isAdmin ? <AddTopicForm course={course} /> : null}

        {course.topics.length === 0 ? (
          <p className="mt-4 border border-black p-5 text-sm text-zinc-600">
            No topics have been added yet.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {course.topics.map((topic) => (
              <TopicCard
                courseId={course.id}
                isAdmin={isAdmin}
                key={topic.id}
                topic={topic}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CourseAiPanel({ course }: { course: CourseDetailData }) {
  const [state, action] = useActionState(
    generateCourseAiAction.bind(null, course.id),
    {},
  );
  const topicOptions = flattenTopicOptions(course.topics);

  return (
    <section>
      <p className="text-sm text-zinc-600">Grounded study help</p>
      <h2 className="mt-1 text-2xl font-semibold">Ask CadeBit</h2>
      <form action={action} className="mt-4 border border-black p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Study action
            <select
              className="mt-1 block w-full border border-black bg-white px-3 py-2"
              defaultValue="answer"
              name="task"
            >
              <option value="answer">Answer a question</option>
              <option value="explain">Explain a concept</option>
              <option value="summarize">Summarize material</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Topic scope
            <select
              className="mt-1 block w-full border border-black bg-white px-3 py-2"
              defaultValue=""
              name="topicId"
            >
              <option value="">Entire course</option>
              {topicOptions.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-3 block text-sm font-medium">
          Request
          <textarea
            className="mt-1 min-h-28 w-full border border-black px-3 py-2"
            maxLength={12_000}
            name="input"
            placeholder="What would you like to understand?"
            required
          />
        </label>
        <div className="mt-3">
          <SubmitButton>Generate</SubmitButton>
        </div>
        {state.error ? (
          <p className="mt-3 text-sm" role="alert">
            {state.error}
          </p>
        ) : null}
      </form>
      {state.result ? <CourseAiResult state={state} /> : null}
    </section>
  );
}

function flattenTopicOptions(
  topics: CourseTopic[],
  parentLabel = "",
): Array<{ id: string; label: string }> {
  return topics.flatMap((topic) => {
    const label = parentLabel ? `${parentLabel} > ${topic.name}` : topic.name;
    return [
      { id: topic.id, label },
      ...flattenTopicOptions(topic.subtopics, label),
    ];
  });
}

function CourseAiResult({ state }: { state: CourseAiActionState }) {
  const result = state.result;
  if (!result) return null;
  return (
    <article className="mt-4 border border-black p-5">
      <p className="whitespace-pre-wrap text-sm leading-6">{result.content}</p>
      <div className="mt-5 border-t border-zinc-300 pt-4">
        <h3 className="text-sm font-semibold">Sources</h3>
        {result.sources.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-600">
            No relevant processed course sources were found.
          </p>
        ) : (
          <ol className="mt-2 space-y-3 text-xs">
            {result.sources.map((source, index) => (
              <li key={source.chunkId ?? `${source.materialId}-${index}`}>
                <p className="font-medium">
                  [{index + 1}] {source.materialTitle}
                  {source.pageNumber ? ` · page ${source.pageNumber}` : ""}
                  {source.section ? ` · ${source.section}` : ""}
                </p>
                {source.excerpt ? (
                  <p className="mt-1 leading-5 text-zinc-600">
                    {source.excerpt}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </article>
  );
}

function MaterialUploadForm({ courseId }: { courseId: string }) {
  const [state, action] = useActionState(
    uploadCourseMaterialAction.bind(null, courseId),
    {},
  );
  return (
    <form action={action} className="mt-4 border border-black p-4">
      <p className="text-sm font-medium">Upload course material</p>
      <p className="mt-1 text-xs text-zinc-600">
        PDF, text, or Markdown up to 20 MB. Processing runs in the background.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          className="border border-black px-3 py-2"
          maxLength={200}
          minLength={2}
          name="title"
          placeholder="Material title"
          required
        />
        <input
          accept="application/pdf,text/plain,text/markdown,.md,.markdown"
          className="border border-black px-3 py-2 text-sm"
          name="material"
          required
          type="file"
        />
        <SubmitButton>Upload</SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TargetDateForm({
  courseId,
  targetDate,
}: {
  courseId: string;
  targetDate: string | null;
}) {
  const [state, action] = useActionState(
    updateTargetDateAction.bind(null, courseId),
    {},
  );
  return (
    <form action={action} className="border border-black p-4">
      <label className="text-sm font-medium" htmlFor="targetDate">
        Your target completion date
      </label>
      <p className="mt-1 text-xs text-zinc-600">
        This changes only your schedule, including in shared courses.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          className="flex-1 border border-black px-3 py-2"
          defaultValue={targetDate ?? ""}
          id="targetDate"
          name="targetDate"
          type="date"
        />
        <SubmitButton>Save date</SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

function AddTopicForm({ course }: { course: CourseDetailData }) {
  const [state, action] = useActionState(
    addTopicAction.bind(null, course.id),
    {},
  );
  return (
    <form action={action} className="mt-4 border border-black p-4">
      <p className="text-sm font-medium">Add to course structure</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          className="border border-black px-3 py-2"
          maxLength={160}
          minLength={2}
          name="name"
          placeholder="Topic name"
          required
        />
        <select
          className="border border-black bg-white px-3 py-2"
          name="parentId"
        >
          <option value="">Top-level topic</option>
          {course.topics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              Subtopic of {topic.name}
            </option>
          ))}
        </select>
        <SubmitButton>Add</SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

function TopicCard({
  courseId,
  isAdmin,
  topic,
}: {
  courseId: string;
  isAdmin: boolean;
  topic: CourseTopic;
}) {
  return (
    <article className="border border-black">
      <TopicRow courseId={courseId} isAdmin={isAdmin} topic={topic} />
      {topic.subtopics.length ? (
        <div className="divide-y divide-zinc-300 border-t border-black pl-5">
          {topic.subtopics.map((subtopic) => (
            <TopicRow
              courseId={courseId}
              isAdmin={isAdmin}
              key={subtopic.id}
              topic={subtopic}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function TopicRow({
  courseId,
  isAdmin,
  topic,
}: {
  courseId: string;
  isAdmin: boolean;
  topic: CourseTopic;
}) {
  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{topic.name}</h3>
          <p className="text-xs text-zinc-600">
            {topic.completed ? "Completed" : "Not completed"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CompletionForm courseId={courseId} topic={topic} />
          <ConfidenceForm courseId={courseId} topic={topic} />
        </div>
      </div>
      {isAdmin ? <TopicAdminForms courseId={courseId} topic={topic} /> : null}
    </div>
  );
}

function CompletionForm({
  courseId,
  topic,
}: {
  courseId: string;
  topic: CourseTopic;
}) {
  const [state, action] = useActionState(
    updateCompletionAction.bind(null, courseId),
    {},
  );
  return (
    <form action={action}>
      <input name="topicId" type="hidden" value={topic.id} />
      <input name="completed" type="hidden" value={String(!topic.completed)} />
      <SubmitButton secondary>
        {topic.completed ? "Mark incomplete" : "Mark complete"}
      </SubmitButton>
      <ActionMessage state={state} />
    </form>
  );
}

function ConfidenceForm({
  courseId,
  topic,
}: {
  courseId: string;
  topic: CourseTopic;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [rating, setRating] = useState(topic.confidence ?? 3);
  const [hasRating, setHasRating] = useState(topic.confidence !== null);
  const [state, action, pending] = useActionState(
    updateConfidenceAction.bind(null, courseId),
    {},
  );

  function saveRating() {
    formRef.current?.requestSubmit();
  }

  return (
    <form action={action} className="min-w-56" ref={formRef}>
      <input name="topicId" type="hidden" value={topic.id} />
      <div className="flex items-center justify-between gap-3 text-xs">
        <label className="font-medium" htmlFor={`confidence-${topic.id}`}>
          Confidence
        </label>
        <output htmlFor={`confidence-${topic.id}`}>
          {hasRating ? `${rating} / 5` : "Not rated"}
        </output>
      </div>
      <input
        aria-valuetext={`${rating} out of 5`}
        className="mt-1 block w-full accent-black"
        id={`confidence-${topic.id}`}
        max={5}
        min={1}
        name="rating"
        onChange={(event) => {
          setRating(Number(event.currentTarget.value));
          setHasRating(true);
        }}
        onKeyUp={(event) => {
          if (
            [
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
              "Home",
              "End",
            ].includes(event.key)
          ) {
            saveRating();
          }
        }}
        onPointerUp={saveRating}
        step={1}
        type="range"
        value={rating}
      />
      <div className="flex justify-between text-[10px] text-zinc-600">
        <span>Low</span>
        <span>High</span>
      </div>
      <p className="mt-1 text-xs" role={state.error ? "alert" : "status"}>
        {pending ? "Saving…" : (state.error ?? state.success)}
      </p>
    </form>
  );
}

function TopicAdminForms({
  courseId,
  topic,
}: {
  courseId: string;
  topic: CourseTopic;
}) {
  const [renameState, renameAction] = useActionState(
    renameTopicAction.bind(null, courseId),
    {},
  );
  const [deleteState, deleteAction] = useActionState(
    deleteTopicAction.bind(null, courseId),
    {},
  );
  return (
    <div className="border-t border-zinc-300 pt-3">
      <div className="flex flex-wrap gap-2">
        <form action={renameAction} className="flex flex-1">
          <input name="topicId" type="hidden" value={topic.id} />
          <input
            aria-label={`Rename ${topic.name}`}
            className="min-w-36 flex-1 border border-black px-2 py-1.5 text-sm"
            defaultValue={topic.name}
            maxLength={160}
            minLength={2}
            name="name"
            required
          />
          <SubmitButton secondary>Rename</SubmitButton>
        </form>
        <form action={deleteAction}>
          <input name="topicId" type="hidden" value={topic.id} />
          <SubmitButton secondary>Delete</SubmitButton>
        </form>
      </div>
      <ActionMessage state={renameState.error ? renameState : deleteState} />
    </div>
  );
}

function SubmitButton({
  children,
  secondary = false,
}: {
  children: ReactNode;
  secondary?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={
        secondary
          ? "border border-black px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:text-zinc-500"
          : "border border-black bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-600"
      }
      disabled={pending}
      type="submit"
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

function ActionMessage({ state }: { state: CourseActionState }) {
  if (!state.error && !state.success) return null;
  return (
    <p className="mt-2 text-xs" role={state.error ? "alert" : "status"}>
      {state.error ?? state.success}
    </p>
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
