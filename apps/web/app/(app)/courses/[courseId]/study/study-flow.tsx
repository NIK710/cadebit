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
  const lesson = session.lesson;
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

      {lesson ? (
        <article className="border border-black p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Learning objective
          </p>
          <h3 className="mt-1 text-lg font-semibold">
            {lesson.learningObjective}
          </h3>
          <p className="mt-2 text-sm text-zinc-600">
            About {lesson.estimatedMinutes} minutes
          </p>
          <div className="mt-6 space-y-6">
            {lesson.blocks.map((block) => {
              if (block.type === "explanation") {
                return (
                  <section key={block.id}>
                    {block.heading ? (
                      <h4 className="font-semibold">{block.heading}</h4>
                    ) : null}
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                      {block.body}
                    </p>
                  </section>
                );
              }
              if (block.type === "example") {
                return (
                  <section
                    className="border-l-2 border-black pl-4"
                    key={block.id}
                  >
                    <h4 className="font-semibold">
                      {block.heading ?? "Example"}
                    </h4>
                    <p className="mt-2 text-sm leading-6">{block.scenario}</p>
                    <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-6">
                      {block.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                    <p className="mt-3 text-sm leading-6">
                      <strong>Takeaway:</strong> {block.takeaway}
                    </p>
                  </section>
                );
              }
              return (
                <section className="border border-black p-4" key={block.id}>
                  <h4 className="font-semibold">{block.prompt}</h4>
                  {block.result ? (
                    <div className="mt-4" aria-live="polite">
                      <ul className="space-y-2 text-sm">
                        {block.choices.map((choice) => (
                          <li
                            className={
                              choice.id === block.result?.selectedChoiceId
                                ? "border border-black bg-zinc-100 p-3"
                                : "border border-zinc-300 p-3"
                            }
                            key={choice.id}
                          >
                            {choice.text}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-4 font-semibold">
                        {block.result.correct ? "Correct" : "Not quite"}
                      </p>
                      <p className="mt-2 text-sm leading-6">
                        {block.result.selectedFeedback}
                      </p>
                      {block.result.misconception ? (
                        <p className="mt-2 text-sm leading-6">
                          <strong>Common misconception:</strong>{" "}
                          {block.result.misconception}
                        </p>
                      ) : null}
                      <p className="mt-2 text-sm leading-6">
                        {block.result.explanation}
                      </p>
                    </div>
                  ) : (
                    <form action={action} className="mt-4 space-y-3">
                      <input name="intent" type="hidden" value="answer" />
                      <input name="lessonId" type="hidden" value={lesson.id} />
                      <input name="blockId" type="hidden" value={block.id} />
                      {block.choices.map((choice) => (
                        <label
                          className="flex cursor-pointer gap-3 border border-black p-3 hover:bg-zinc-100"
                          key={choice.id}
                        >
                          <input
                            name="selectedChoiceId"
                            required
                            type="radio"
                            value={choice.id}
                          />
                          <span className="text-sm">{choice.text}</span>
                        </label>
                      ))}
                      <SubmitButton>Submit answer</SubmitButton>
                    </form>
                  )}
                </section>
              );
            })}
          </div>
          <SourceList sources={lesson.sources} />
        </article>
      ) : (
        <p className="border border-black p-5">
          This older session has no micro-lesson. Complete it to start a new
          lesson.
        </p>
      )}

      <form action={action}>
        <input name="intent" type="hidden" value="complete" />
        <input name="sessionId" type="hidden" value={session.id} />
        <SubmitButton>Complete session</SubmitButton>
      </form>
    </section>
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
