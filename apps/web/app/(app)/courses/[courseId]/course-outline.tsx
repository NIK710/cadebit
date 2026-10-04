"use client";

import {
  Fragment,
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { serializeCourseOutline } from "@/lib/course-outline";
import type { CourseDetail, CourseTopic } from "@/lib/courses";

import {
  addTopicAction,
  deleteTopicAction,
  renameTopicAction,
  reorderTopicsAction,
  replaceCourseOutlineAction,
  updateCompletionAction,
  updateConfidenceAction,
  updateTopicContextAction,
  type CourseActionState,
} from "../actions";
import { Modal } from "./modal";

type DraggedTopic = {
  id: string;
  parentKey: string;
};

export function CourseOutline({ course }: { course: CourseDetail }) {
  const isAdmin = course.role === "admin";
  const router = useRouter();
  const [addTopicOpen, setAddTopicOpen] = useState(false);
  const [bulkEditorOpen, setBulkEditorOpen] = useState(false);
  const [dragged, setDragged] = useState<DraggedTopic | null>(null);
  const [orderState, setOrderState] = useState<CourseActionState>({});
  const [isOrdering, startOrdering] = useTransition();

  function persistOrder(orderedTopicIds: string[]) {
    setOrderState({});
    startOrdering(async () => {
      const result = await reorderTopicsAction(course.id, orderedTopicIds);
      setOrderState(result);
      if (result.success) router.refresh();
    });
  }

  function moveTopic(
    siblings: CourseTopic[],
    topicId: string,
    direction: -1 | 1,
  ) {
    const orderedIds = siblings.map((topic) => topic.id);
    const currentIndex = orderedIds.indexOf(topicId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedIds.length)
      return;
    [orderedIds[currentIndex], orderedIds[nextIndex]] = [
      orderedIds[nextIndex],
      orderedIds[currentIndex],
    ];
    persistOrder(orderedIds);
  }

  function dropTopic(
    siblings: CourseTopic[],
    targetId: string,
    parentKey: string,
    placeAfter: boolean,
  ) {
    if (!dragged || dragged.parentKey !== parentKey || dragged.id === targetId)
      return;
    const orderedIds = siblings
      .map((topic) => topic.id)
      .filter((id) => id !== dragged.id);
    const targetIndex = orderedIds.indexOf(targetId);
    if (targetIndex < 0) return;
    orderedIds.splice(targetIndex + (placeAfter ? 1 : 0), 0, dragged.id);
    setDragged(null);
    persistOrder(orderedIds);
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-600">Course structure</p>
          <h2 className="mt-1 text-2xl font-semibold">Topics and subtopics</h2>
        </div>
        {isAdmin ? (
          <div className="flex flex-wrap gap-2">
            <button
              aria-label="Edit full course outline"
              className="flex items-center gap-2 border border-black px-3 py-2 text-sm hover:bg-zinc-100"
              onClick={() => setBulkEditorOpen(true)}
              title="Edit full course outline"
              type="button"
            >
              <OutlineEditIcon />
              Edit outline
            </button>
            <button
              className="border border-black bg-black px-3 py-2 text-sm text-white hover:bg-zinc-800"
              onClick={() => setAddTopicOpen(true)}
              type="button"
            >
              + Add topic
            </button>
          </div>
        ) : (
          <span className="text-xs text-zinc-600">
            Only admins can edit the shared structure.
          </span>
        )}
      </div>

      {orderState.error || orderState.success || isOrdering ? (
        <p
          className="mt-3 text-xs"
          role={orderState.error ? "alert" : "status"}
        >
          {isOrdering
            ? "Saving topic order…"
            : (orderState.error ?? orderState.success)}
        </p>
      ) : null}

      {course.topics.length === 0 ? (
        <p className="mt-4 border border-black p-5 text-sm text-zinc-600">
          No topics have been added yet.
        </p>
      ) : (
        <div className="mt-4 border border-black">
          <OutlineLevel
            courseId={course.id}
            depth={1}
            dragged={dragged}
            isAdmin={isAdmin}
            onDragEnd={() => setDragged(null)}
            onDragStart={setDragged}
            onDropTopic={dropTopic}
            onMove={moveTopic}
            parentId={null}
            topics={course.topics}
          />
        </div>
      )}

      {addTopicOpen ? (
        <AddTopicModal
          courseId={course.id}
          onClose={() => setAddTopicOpen(false)}
          parent={null}
        />
      ) : null}
      {bulkEditorOpen ? (
        <BulkOutlineModal
          courseId={course.id}
          onClose={() => setBulkEditorOpen(false)}
          topics={course.topics}
        />
      ) : null}
    </section>
  );
}

function OutlineLevel({
  courseId,
  depth,
  dragged,
  isAdmin,
  onDragEnd,
  onDragStart,
  onDropTopic,
  onMove,
  parentId,
  topics,
}: {
  courseId: string;
  depth: 1 | 2 | 3;
  dragged: DraggedTopic | null;
  isAdmin: boolean;
  onDragEnd: () => void;
  onDragStart: (topic: DraggedTopic) => void;
  onDropTopic: (
    siblings: CourseTopic[],
    targetId: string,
    parentKey: string,
    placeAfter: boolean,
  ) => void;
  onMove: (siblings: CourseTopic[], topicId: string, direction: -1 | 1) => void;
  parentId: string | null;
  topics: CourseTopic[];
}) {
  const parentKey = parentId ?? "root";
  return topics.map((topic, index) => (
    <Fragment key={topic.id}>
      <OutlineItem
        courseId={courseId}
        depth={depth}
        dragged={dragged}
        index={index}
        isAdmin={isAdmin}
        onDragEnd={onDragEnd}
        onDragStart={onDragStart}
        onDropTopic={onDropTopic}
        onMove={onMove}
        parentKey={parentKey}
        siblings={topics}
        topic={topic}
      />
      {topic.subtopics.length > 0 && depth < 3 ? (
        <OutlineLevel
          courseId={courseId}
          depth={(depth + 1) as 2 | 3}
          dragged={dragged}
          isAdmin={isAdmin}
          onDragEnd={onDragEnd}
          onDragStart={onDragStart}
          onDropTopic={onDropTopic}
          onMove={onMove}
          parentId={topic.id}
          topics={topic.subtopics}
        />
      ) : null}
    </Fragment>
  ));
}

function OutlineItem({
  courseId,
  depth,
  dragged,
  index,
  isAdmin,
  onDragEnd,
  onDragStart,
  onDropTopic,
  onMove,
  parentKey,
  siblings,
  topic,
}: {
  courseId: string;
  depth: 1 | 2 | 3;
  dragged: DraggedTopic | null;
  index: number;
  isAdmin: boolean;
  onDragEnd: () => void;
  onDragStart: (topic: DraggedTopic) => void;
  onDropTopic: (
    siblings: CourseTopic[],
    targetId: string,
    parentKey: string,
    placeAfter: boolean,
  ) => void;
  onMove: (siblings: CourseTopic[], topicId: string, direction: -1 | 1) => void;
  parentKey: string;
  siblings: CourseTopic[];
  topic: CourseTopic;
}) {
  const [modal, setModal] = useState<
    "add" | "rename" | "context" | "delete" | null
  >(null);
  const indentation = depth === 1 ? "pl-3" : depth === 2 ? "pl-10" : "pl-16";
  const levelLabel =
    depth === 1 ? "Topic" : depth === 2 ? "Subtopic" : "Sub-subtopic";

  return (
    <div
      className={`border-b border-zinc-300 py-3 pr-3 ${indentation} ${dragged?.id === topic.id ? "bg-zinc-100 opacity-60" : "bg-white"}`}
      onDragOver={(event) => {
        if (dragged?.parentKey === parentKey) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const bounds = event.currentTarget.getBoundingClientRect();
        onDropTopic(
          siblings,
          topic.id,
          parentKey,
          event.clientY > bounds.top + bounds.height / 2,
        );
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          {isAdmin ? (
            <button
              aria-label={`Drag to reorder ${topic.name}`}
              className="mt-0.5 cursor-grab p-1 text-zinc-600 hover:bg-zinc-100 active:cursor-grabbing"
              draggable
              onDragEnd={onDragEnd}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", topic.id);
                onDragStart({ id: topic.id, parentKey });
              }}
              title="Drag to reorder"
              type="button"
            >
              <GripIcon />
            </button>
          ) : (
            <span aria-hidden="true" className="mt-1 w-5" />
          )}
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">
              {levelLabel}
            </p>
            <h3 className="break-words font-semibold">{topic.name}</h3>
            <p className="mt-0.5 text-xs text-zinc-600">
              {topic.completed ? "Completed" : "Not completed"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-3">
          <CompletionForm courseId={courseId} topic={topic} />
          <ConfidenceForm courseId={courseId} topic={topic} />
          {isAdmin ? (
            <details className="relative">
              <summary
                aria-label={`Actions for ${topic.name}`}
                className="cursor-pointer list-none px-2 py-1 text-lg leading-none hover:bg-zinc-100 [&::-webkit-details-marker]:hidden"
                title={`Actions for ${topic.name}`}
              >
                ⋯
              </summary>
              <div className="absolute right-0 z-10 mt-1 min-w-44 border border-black bg-white p-1 text-sm">
                <MenuButton onClick={() => setModal("rename")}>
                  Rename
                </MenuButton>
                <MenuButton onClick={() => setModal("context")}>
                  Edit context
                </MenuButton>
                {depth < 3 ? (
                  <MenuButton onClick={() => setModal("add")}>
                    {depth === 1 ? "Add subtopic" : "Add sub-subtopic"}
                  </MenuButton>
                ) : null}
                <MenuButton
                  disabled={index === 0}
                  onClick={() => onMove(siblings, topic.id, -1)}
                >
                  Move up
                </MenuButton>
                <MenuButton
                  disabled={index === siblings.length - 1}
                  onClick={() => onMove(siblings, topic.id, 1)}
                >
                  Move down
                </MenuButton>
                <MenuButton destructive onClick={() => setModal("delete")}>
                  Delete
                </MenuButton>
              </div>
            </details>
          ) : null}
        </div>
      </div>

      {modal === "add" ? (
        <AddTopicModal
          courseId={courseId}
          onClose={() => setModal(null)}
          parent={topic}
        />
      ) : null}
      {modal === "rename" ? (
        <RenameTopicModal
          courseId={courseId}
          onClose={() => setModal(null)}
          topic={topic}
        />
      ) : null}
      {modal === "context" ? (
        <TopicContextModal
          courseId={courseId}
          onClose={() => setModal(null)}
          topic={topic}
        />
      ) : null}
      {modal === "delete" ? (
        <DeleteTopicModal
          courseId={courseId}
          onClose={() => setModal(null)}
          topic={topic}
        />
      ) : null}
    </div>
  );
}

function AddTopicModal({
  courseId,
  onClose,
  parent,
}: {
  courseId: string;
  onClose: () => void;
  parent: CourseTopic | null;
}) {
  const [state, action, pending] = useActionState(
    addTopicAction.bind(null, courseId),
    {},
  );
  useCloseAfterSuccess(pending, state.success, onClose);

  return (
    <Modal
      onClose={onClose}
      title={parent ? `Add under ${parent.name}` : "Add topic"}
    >
      <form action={action}>
        <input name="parentId" type="hidden" value={parent?.id ?? ""} />
        <label
          className="text-sm font-medium"
          htmlFor={`add-${parent?.id ?? "root"}`}
        >
          {parent ? "Child topic name" : "Topic name"}
        </label>
        <input
          className="mt-2 block w-full border border-black px-3 py-2"
          data-modal-initial-focus
          id={`add-${parent?.id ?? "root"}`}
          maxLength={160}
          minLength={2}
          name="name"
          required
        />
        <ActionMessage state={state} />
        <ModalActions onCancel={onClose} submitLabel="Add" />
      </form>
    </Modal>
  );
}

function RenameTopicModal({
  courseId,
  onClose,
  topic,
}: {
  courseId: string;
  onClose: () => void;
  topic: CourseTopic;
}) {
  const [state, action, pending] = useActionState(
    renameTopicAction.bind(null, courseId),
    {},
  );
  useCloseAfterSuccess(pending, state.success, onClose);

  return (
    <Modal onClose={onClose} title={`Rename ${topic.name}`}>
      <form action={action}>
        <input name="topicId" type="hidden" value={topic.id} />
        <label className="text-sm font-medium" htmlFor={`rename-${topic.id}`}>
          Name
        </label>
        <input
          className="mt-2 block w-full border border-black px-3 py-2"
          data-modal-initial-focus
          defaultValue={topic.name}
          id={`rename-${topic.id}`}
          maxLength={160}
          minLength={2}
          name="name"
          required
        />
        <ActionMessage state={state} />
        <ModalActions onCancel={onClose} submitLabel="Save" />
      </form>
    </Modal>
  );
}

function TopicContextModal({
  courseId,
  onClose,
  topic,
}: {
  courseId: string;
  onClose: () => void;
  topic: CourseTopic;
}) {
  const [state, action, pending] = useActionState(
    updateTopicContextAction.bind(null, courseId),
    {},
  );
  useCloseAfterSuccess(pending, state.success, onClose);

  return (
    <Modal onClose={onClose} title={`Context for ${topic.name}`}>
      <form action={action}>
        <input name="topicId" type="hidden" value={topic.id} />
        <label className="text-sm font-medium" htmlFor={`context-${topic.id}`}>
          Optional context or description
        </label>
        <textarea
          className="mt-2 min-h-40 w-full border border-black px-3 py-2"
          data-modal-initial-focus
          defaultValue={topic.description}
          id={`context-${topic.id}`}
          maxLength={4_000}
          name="context"
          placeholder="What should CadeBit understand about this topic?"
        />
        <p className="mt-1 text-xs text-zinc-600">
          Used as metadata for understanding, generation, and retrieval.
        </p>
        <ActionMessage state={state} />
        <ModalActions onCancel={onClose} submitLabel="Save" />
      </form>
    </Modal>
  );
}

function DeleteTopicModal({
  courseId,
  onClose,
  topic,
}: {
  courseId: string;
  onClose: () => void;
  topic: CourseTopic;
}) {
  const [state, action, pending] = useActionState(
    deleteTopicAction.bind(null, courseId),
    {},
  );
  useCloseAfterSuccess(pending, state.success, onClose);
  const descendantCount = countDescendants(topic);

  return (
    <Modal onClose={onClose} title={`Delete ${topic.name}?`}>
      <form action={action}>
        <input name="topicId" type="hidden" value={topic.id} />
        <p className="text-sm leading-6">
          This removes the item from the course outline
          {descendantCount > 0
            ? ` along with ${descendantCount} nested ${descendantCount === 1 ? "item" : "items"}`
            : ""}
          . This action cannot be undone.
        </p>
        <ActionMessage state={state} />
        <div className="mt-5 flex justify-end gap-2">
          <button
            className="border border-black px-4 py-2 text-sm hover:bg-zinc-100"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <FormSubmitButton destructive>Delete</FormSubmitButton>
        </div>
      </form>
    </Modal>
  );
}

function BulkOutlineModal({
  courseId,
  onClose,
  topics,
}: {
  courseId: string;
  onClose: () => void;
  topics: CourseTopic[];
}) {
  const [state, action, pending] = useActionState(
    replaceCourseOutlineAction.bind(null, courseId),
    {},
  );
  useCloseAfterSuccess(pending, state.success, onClose);

  return (
    <Modal onClose={onClose} title="Edit full course outline" wide>
      <form action={action}>
        <label className="text-sm font-medium" htmlFor="bulk-course-outline">
          Course outline
        </label>
        <p className="mt-1 text-xs leading-5 text-zinc-600">
          Use indentation and optional bullets for up to three levels: topic,
          subtopic, and sub-subtopic.
        </p>
        <textarea
          className="mt-3 min-h-80 w-full border border-black px-3 py-2 font-mono text-sm leading-6"
          data-modal-initial-focus
          defaultValue={serializeCourseOutline(topics)}
          id="bulk-course-outline"
          maxLength={50_000}
          name="outline"
          placeholder={
            "Chapter 1: Probability\n  - Sample Spaces\n  - Conditional Probability\n    - Bayes' Rule"
          }
        />
        <div className="mt-4 border border-black bg-zinc-100 p-3">
          <p className="text-sm font-medium">
            This replaces the current outline.
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-600">
            Items removed from the text, or renamed here, may lose their saved
            learning state. Use an item&apos;s Rename action for simple renames,
            and review the complete text before saving.
          </p>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input
              className="mt-0.5"
              name="confirmReplacement"
              required
              type="checkbox"
              value="confirmed"
            />
            <span>I understand that saving replaces the current outline.</span>
          </label>
        </div>
        <ActionMessage state={state} />
        <ModalActions onCancel={onClose} submitLabel="Replace outline" />
      </form>
    </Modal>
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
      <FormSubmitButton secondary>
        {topic.completed ? "Mark incomplete" : "Mark complete"}
      </FormSubmitButton>
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
    <form action={action} className="min-w-44" ref={formRef}>
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
      <p className="mt-1 text-xs" role={state.error ? "alert" : "status"}>
        {pending ? "Saving…" : (state.error ?? state.success)}
      </p>
    </form>
  );
}

function MenuButton({
  children,
  destructive = false,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`block w-full px-3 py-2 text-left disabled:text-zinc-400 ${destructive ? "hover:bg-red-50 hover:text-red-700" : "hover:bg-zinc-100"}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function ModalActions({
  onCancel,
  submitLabel,
}: {
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button
        className="border border-black px-4 py-2 text-sm hover:bg-zinc-100"
        onClick={onCancel}
        type="button"
      >
        Cancel
      </button>
      <FormSubmitButton>{submitLabel}</FormSubmitButton>
    </div>
  );
}

function FormSubmitButton({
  children,
  destructive = false,
  secondary = false,
}: {
  children: React.ReactNode;
  destructive?: boolean;
  secondary?: boolean;
}) {
  const { pending } = useFormStatus();
  const className = destructive
    ? "border border-black px-4 py-2 text-sm hover:bg-red-50 hover:text-red-700 disabled:text-zinc-500"
    : secondary
      ? "border border-black px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:text-zinc-500"
      : "border border-black bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-600";
  return (
    <button className={className} disabled={pending} type="submit">
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

function useCloseAfterSuccess(
  pending: boolean,
  success: string | undefined,
  onClose: () => void,
) {
  const submitted = useRef(false);
  useEffect(() => {
    if (pending) {
      submitted.current = true;
      return;
    }
    if (submitted.current && success) {
      submitted.current = false;
      onClose();
    }
  }, [onClose, pending, success]);
}

function countDescendants(topic: CourseTopic): number {
  return topic.subtopics.reduce(
    (total, child) => total + 1 + countDescendants(child),
    0,
  );
}

function GripIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height="18"
      viewBox="0 0 18 18"
      width="18"
    >
      <circle cx="5" cy="4" r="1.2" />
      <circle cx="12" cy="4" r="1.2" />
      <circle cx="5" cy="9" r="1.2" />
      <circle cx="12" cy="9" r="1.2" />
      <circle cx="5" cy="14" r="1.2" />
      <circle cx="12" cy="14" r="1.2" />
    </svg>
  );
}

function OutlineEditIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
    >
      <path
        d="M4 6h10M4 12h7M4 18h10m3-4 3-3 2 2-3 3-3 1 1-3Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
