"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { SourceReference } from "@/lib/ai-service";
import type { AdaptiveStudyView } from "@/lib/db/adaptive-study";

import { adaptiveStudyAction } from "./actions";

export function AdaptiveStudyFlow({
  initialView,
}: {
  initialView: AdaptiveStudyView;
}) {
  const [state, action] = useActionState(
    adaptiveStudyAction.bind(null, initialView.courseId),
    { view: initialView },
  );
  const view = state.view ?? initialView;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link className="text-sm underline" href={`/courses/${view.courseId}`}>
        Back to course
      </Link>
      <div className="mt-5 border-b border-black pb-5">
        <p className="text-sm text-zinc-600">Adaptive study</p>
        <h1 className="mt-1 text-3xl font-semibold">{view.courseName}</h1>
      </div>

      {state.completed ? (
        <p className="mt-5 border border-black bg-zinc-100 p-4" role="status">
          Session completed. Your study time and topic activity were recorded.
        </p>
      ) : null}
      {state.error ? (
        <p className="mt-5 border border-black p-4" role="alert">
          {state.error}
        </p>
      ) : null}

      {view.session ? (
        <ActiveSession action={action} view={view} />
      ) : (
        <StartSession action={action} view={view} />
      )}
    </main>
  );
}

function StartSession({
  action,
  view,
}: {
  action: (formData: FormData) => void;
  view: AdaptiveStudyView;
}) {
  if (view.topics.length === 0) {
    return (
      <p className="mt-6 border border-black p-5">
        Add at least one topic before starting an adaptive study session.
      </p>
    );
  }
  return (
    <section className="mt-6 border border-black p-5">
      <h2 className="text-xl font-semibold">Start a focused session</h2>
      {view.recommendation ? (
        <div className="mt-4 border border-black bg-zinc-100 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide">
            Recommended next
          </p>
          <p className="mt-1 font-medium">{view.recommendation.name}</p>
          <p className="mt-1 text-sm text-zinc-700">
            {view.recommendation.reason}
          </p>
          <p className="mt-2 text-xs text-zinc-600">
            System mastery: {formatMastery(view.recommendation.mastery)}
          </p>
        </div>
      ) : null}
      <form action={action} className="mt-5 space-y-3">
        <input name="intent" type="hidden" value="start" />
        <label className="block text-sm font-medium" htmlFor="topicId">
          Topic
        </label>
        <select
          className="w-full border border-black bg-white px-3 py-2"
          defaultValue={view.recommendation?.id ?? view.topics[0].id}
          id="topicId"
          name="topicId"
        >
          {view.topics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.name}
            </option>
          ))}
        </select>
        <SubmitButton>Start session</SubmitButton>
      </form>
    </section>
  );
}

function ActiveSession({
  action,
  view,
}: {
  action: (formData: FormData) => void;
  view: AdaptiveStudyView;
}) {
  const session = view.session!;
  return (
    <section className="mt-6 space-y-5">
      <div className="border border-black p-5">
        <p className="text-xs uppercase tracking-wide text-zinc-600">
          Current topic
        </p>
        <h2 className="mt-1 text-xl font-semibold">{session.topicName}</h2>
        <p className="mt-2 text-sm">
          System mastery: {formatMastery(session.mastery)}
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          This score is derived from graded evidence. Your self-confidence
          remains separate.
        </p>
      </div>

      {session.latestResult ? (
        <GradeResult result={session.latestResult} />
      ) : null}
      {session.question ? (
        <form action={action} className="border border-black p-5">
          <input name="intent" type="hidden" value="answer" />
          <input name="questionId" type="hidden" value={session.question.id} />
          <p className="text-xs text-zinc-600">
            Difficulty {Math.round(session.question.difficulty * 100)}%
          </p>
          <h3 className="mt-2 text-lg font-semibold">
            {session.question.question}
          </h3>
          <label className="mt-5 block text-sm font-medium" htmlFor="answer">
            Your answer
          </label>
          <textarea
            className="mt-1 min-h-36 w-full border border-black px-3 py-2"
            id="answer"
            maxLength={12_000}
            name="answer"
            required
          />
          <div className="mt-3">
            <SubmitButton>Grade answer</SubmitButton>
          </div>
          <SourceList sources={session.question.sources} />
        </form>
      ) : (
        <form action={action} className="border border-black p-5">
          <input name="intent" type="hidden" value="generate" />
          <input name="sessionId" type="hidden" value={session.id} />
          <h3 className="font-semibold">
            Generate a grounded practice question
          </h3>
          <label
            className="mt-4 block text-sm font-medium"
            htmlFor="difficulty"
          >
            Difficulty
          </label>
          <select
            className="mt-1 w-full border border-black bg-white px-3 py-2"
            defaultValue="0.6"
            id="difficulty"
            name="difficulty"
          >
            <option value="0.35">Foundation</option>
            <option value="0.6">Standard</option>
            <option value="0.85">Challenge</option>
          </select>
          <div className="mt-3">
            <SubmitButton>Generate question</SubmitButton>
          </div>
        </form>
      )}

      <form action={action}>
        <input name="intent" type="hidden" value="complete" />
        <input name="sessionId" type="hidden" value={session.id} />
        <SubmitButton>Complete session</SubmitButton>
      </form>
    </section>
  );
}

function GradeResult({
  result,
}: {
  result: NonNullable<AdaptiveStudyView["session"]>["latestResult"];
}) {
  if (!result) return null;
  return (
    <article className="border border-black bg-zinc-100 p-5" aria-live="polite">
      <h3 className="font-semibold">
        Score: {Math.round(result.score * 100)}% ·{" "}
        {result.correct ? "Correct" : "Keep working"}
      </h3>
      <p className="mt-2 text-sm leading-6">{result.feedback}</p>
      {result.strengths.length ? (
        <p className="mt-3 text-sm">
          <strong>Strengths:</strong> {result.strengths.join("; ")}
        </p>
      ) : null}
      {result.gaps.length ? (
        <p className="mt-2 text-sm">
          <strong>Review:</strong> {result.gaps.join("; ")}
        </p>
      ) : null}
    </article>
  );
}

function SourceList({ sources }: { sources: SourceReference[] }) {
  if (!sources.length) return null;
  return (
    <div className="mt-5 border-t border-zinc-300 pt-4">
      <p className="text-xs font-semibold">Grounded in</p>
      <ul className="mt-2 space-y-1 text-xs text-zinc-600">
        {sources.map((source, index) => (
          <li key={source.chunkId ?? `${source.materialId}-${index}`}>
            [{index + 1}] {source.materialTitle}
            {source.pageNumber ? `, page ${source.pageNumber}` : ""}
            {source.section ? `, ${source.section}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="border border-black bg-white px-4 py-2 text-sm hover:bg-zinc-100 disabled:text-zinc-500"
      disabled={pending}
      type="submit"
    >
      {pending ? "Working…" : children}
    </button>
  );
}

function formatMastery(value: number | null): string {
  return value === null ? "Not assessed" : `${Math.round(value * 100)}%`;
}
