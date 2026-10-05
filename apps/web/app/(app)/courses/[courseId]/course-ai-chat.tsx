"use client";

import { useActionState, useEffect, useRef } from "react";

import type { SourceReference } from "@/lib/ai-service";
import type { CourseAiConversationView } from "@/lib/db/course-ai";

import { courseAiAction } from "./course-ai-actions";
import { Modal } from "./modal";

export function CourseAiChat({
  courseId,
  courseName,
  initialView,
  onClose,
  open,
}: {
  courseId: string;
  courseName: string;
  initialView: CourseAiConversationView;
  onClose: () => void;
  open: boolean;
}) {
  const [state, action, pending] = useActionState(
    courseAiAction.bind(null, courseId),
    { view: initialView, sequence: 0 },
  );
  const formRef = useRef<HTMLFormElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const previousSequence = useRef(state.sequence);

  useEffect(() => {
    if (state.sequence !== previousSequence.current) {
      previousSequence.current = state.sequence;
      formRef.current?.reset();
    }
  }, [state.sequence]);

  useEffect(() => {
    if (open) conversationEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [open, state.view.messages]);

  if (!open) return null;

  return (
    <Modal onClose={onClose} title="CadeBit AI" wide>
      <div className="flex min-h-[32rem] flex-col">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-sm text-zinc-600">
            {courseName} · Grounded in your course materials
          </p>
          <form action={action}>
            <input name="intent" type="hidden" value="reset" />
            <button
              className="text-xs underline underline-offset-4 hover:bg-zinc-100 disabled:text-zinc-400"
              disabled={pending || state.view.messages.length === 0}
              onClick={(event) => {
                if (
                  !window.confirm(
                    "Start a new conversation? Your current chat history will be permanently removed.",
                  )
                ) {
                  event.preventDefault();
                }
              }}
              type="submit"
            >
              New conversation
            </button>
          </form>
        </div>

        <div
          aria-live="polite"
          className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto border border-black p-4"
        >
          {state.view.earlierMessagesOmitted ? (
            <p className="text-center text-xs text-zinc-500">
              Earlier messages are not shown.
            </p>
          ) : null}
          {state.view.messages.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center text-center text-sm text-zinc-600">
              Ask anything about {courseName}.
            </div>
          ) : (
            state.view.messages.map((message) => (
              <article
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[85%] border border-black bg-zinc-100 p-3"
                    : "max-w-[90%] border-l-2 border-black pl-3"
                }
                key={message.id}
              >
                <p className="whitespace-pre-wrap text-sm leading-6">
                  {message.content}
                </p>
                {message.role === "assistant" ? (
                  <SourceReferences sources={message.sources} />
                ) : null}
              </article>
            ))
          )}
          {pending ? (
            <p className="max-w-[90%] border-l-2 border-zinc-400 pl-3 text-sm text-zinc-500">
              CadeBit is thinking…
            </p>
          ) : null}
          <div ref={conversationEndRef} />
        </div>

        {state.error ? (
          <p
            className="mt-3 border border-black bg-zinc-100 p-3 text-sm"
            role="alert"
          >
            {state.error}
          </p>
        ) : null}

        <form action={action} className="mt-4 flex gap-2" ref={formRef}>
          <input name="intent" type="hidden" value="send" />
          <input
            name="conversationId"
            type="hidden"
            value={state.view.id ?? ""}
          />
          <input name="revision" type="hidden" value={state.view.revision} />
          <textarea
            className="min-h-20 flex-1 resize-y border border-black px-3 py-2 text-sm disabled:bg-zinc-100"
            data-modal-initial-focus
            disabled={pending}
            maxLength={4_000}
            name="message"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={`Ask anything about ${courseName}...`}
            required
          />
          <button
            className="self-end border border-black px-4 py-2 text-sm hover:bg-zinc-100 disabled:text-zinc-400"
            disabled={pending}
            type="submit"
          >
            {pending ? "Sending…" : "Send"}
          </button>
        </form>
        <p className="mt-1 text-xs text-zinc-500">
          Enter to send · Shift+Enter for a new line
        </p>
      </div>
    </Modal>
  );
}

function SourceReferences({ sources }: { sources: SourceReference[] }) {
  if (!sources.length) return null;
  return (
    <div className="mt-3 border-t border-zinc-300 pt-2">
      <p className="text-xs font-semibold">Sources</p>
      <ul className="mt-1 space-y-1 text-xs text-zinc-600">
        {sources.map((source, index) => (
          <li key={source.chunkId ?? `${source.materialId}-${index}`}>
            [{index + 1}] {source.materialTitle}
            {source.pageNumber ? `, page ${source.pageNumber}` : ""}
            {source.section ? ` · ${source.section}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
