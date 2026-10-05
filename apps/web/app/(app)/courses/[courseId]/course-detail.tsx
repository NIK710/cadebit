"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";

import {
  formatCourseDate,
  type CourseDetail as CourseDetailData,
} from "@/lib/courses";
import type { CourseMaterialSummary } from "@/lib/db/material-management";
import type { CourseAiConversationView } from "@/lib/db/course-ai";

import {
  deleteCourseMaterialAction,
  updateTargetDateAction,
  uploadCourseMaterialAction,
  type CourseActionState,
} from "../actions";
import { CourseOutline } from "./course-outline";
import { CourseAiChat } from "./course-ai-chat";
import { Modal } from "./modal";

export function CourseDetail({
  course,
  courseAiConversation,
  materials,
}: {
  course: CourseDetailData;
  courseAiConversation: CourseAiConversationView;
  materials: CourseMaterialSummary[];
}) {
  const isAdmin = course.role === "admin";
  const [targetDateOpen, setTargetDateOpen] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [courseAiOpen, setCourseAiOpen] = useState(false);

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
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="border border-black px-3 py-2 text-sm hover:bg-zinc-100"
                onClick={() => setMaterialsOpen(true)}
                type="button"
              >
                Course materials
              </button>
              <button
                className="border border-black px-3 py-2 text-sm hover:bg-zinc-100"
                onClick={() => setCourseAiOpen(true)}
                type="button"
              >
                CadeBit AI
              </button>
            </div>
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
        <TargetDateCard
          onEdit={() => setTargetDateOpen(true)}
          targetDate={course.targetDate}
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

      <section className="border border-black p-5">
        <p className="text-sm text-zinc-600">CadeBit Study</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Study the next topic</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Learn through a short, grounded lesson that adapts to your
              progress.
            </p>
          </div>
          <Link
            className="border border-black px-4 py-2 text-sm hover:bg-zinc-100"
            href={`/courses/${course.id}/study`}
          >
            Start studying
          </Link>
        </div>
      </section>

      <CourseOutline course={course} />

      {targetDateOpen ? (
        <TargetDateModal
          courseId={course.id}
          onClose={() => setTargetDateOpen(false)}
          targetDate={course.targetDate}
        />
      ) : null}
      {materialsOpen ? (
        <CourseMaterialsModal
          courseId={course.id}
          isAdmin={isAdmin}
          materials={materials}
          onClose={() => setMaterialsOpen(false)}
        />
      ) : null}
      <CourseAiChat
        courseId={course.id}
        courseName={course.name}
        initialView={courseAiConversation}
        onClose={() => setCourseAiOpen(false)}
        open={courseAiOpen}
      />
    </div>
  );
}

function TargetDateCard({
  onEdit,
  targetDate,
}: {
  onEdit: () => void;
  targetDate: string | null;
}) {
  return (
    <div className="border border-black p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-600">
        Target date
      </p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="font-semibold">{formatCourseDate(targetDate)}</p>
        <button
          aria-label="Edit target date"
          className="p-1.5 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          onClick={onEdit}
          title="Edit target date"
          type="button"
        >
          <PencilIcon />
        </button>
      </div>
    </div>
  );
}

function TargetDateModal({
  courseId,
  onClose,
  targetDate,
}: {
  courseId: string;
  onClose: () => void;
  targetDate: string | null;
}) {
  const [state, action, pending] = useActionState(
    updateTargetDateAction.bind(null, courseId),
    {},
  );
  const submitted = useRef(false);

  useEffect(() => {
    if (pending) {
      submitted.current = true;
      return;
    }
    if (submitted.current && state.success) {
      submitted.current = false;
      onClose();
    }
  }, [onClose, pending, state.success]);

  return (
    <Modal onClose={onClose} title="Target completion date">
      <form action={action}>
        <label className="text-sm font-medium" htmlFor="targetDate">
          Target completion date
        </label>
        <input
          className="mt-2 block w-full border border-black px-3 py-2"
          data-modal-initial-focus
          defaultValue={targetDate ?? ""}
          id="targetDate"
          name="targetDate"
          type="date"
        />
        <p className="mt-2 text-xs leading-5 text-zinc-600">
          This changes only your schedule, including in shared courses.
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
          <SubmitButton>Save</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

function CourseMaterialsModal({
  courseId,
  isAdmin,
  materials,
  onClose,
}: {
  courseId: string;
  isAdmin: boolean;
  materials: CourseMaterialSummary[];
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose} title="Course materials" wide>
      <p className="text-sm text-zinc-600">
        View uploaded course sources and their processing status.
      </p>

      {isAdmin ? (
        <MaterialUploadForm courseId={courseId} />
      ) : (
        <p className="mt-4 border border-black bg-zinc-100 p-3 text-xs text-zinc-600">
          Only course admins can upload or remove course materials.
        </p>
      )}

      {materials.length === 0 ? (
        <p className="mt-4 border border-black p-5 text-sm text-zinc-600">
          No course materials have been uploaded.
        </p>
      ) : (
        <div className="mt-4 divide-y divide-zinc-300 border border-black">
          {materials.map((material) => (
            <MaterialRow
              courseId={courseId}
              isAdmin={isAdmin}
              key={material.id}
              material={material}
            />
          ))}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button
          className="border border-black px-4 py-2 text-sm hover:bg-zinc-100"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </div>
    </Modal>
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

function MaterialRow({
  courseId,
  isAdmin,
  material,
}: {
  courseId: string;
  isAdmin: boolean;
  material: CourseMaterialSummary;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(
    deleteCourseMaterialAction.bind(null, courseId),
    {},
  );

  return (
    <article className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{material.title}</h3>
          <p className="mt-1 break-all text-xs text-zinc-600">
            {material.originalFilename} · {formatFileSize(material.byteSize)}
          </p>
          {material.status === "failed" ? (
            <p className="mt-2 text-xs" role="alert">
              Processing failed. Try again.
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="border border-black px-2 py-1 text-xs uppercase">
            {material.status}
          </span>
          {isAdmin && !confirming ? (
            <button
              aria-label={`Delete ${material.title}`}
              className="p-1.5 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
              onClick={() => setConfirming(true)}
              title={`Delete ${material.title}`}
              type="button"
            >
              <TrashIcon />
            </button>
          ) : null}
        </div>
      </div>

      {isAdmin && confirming ? (
        <form action={action} className="mt-3 border-t border-zinc-300 pt-3">
          <input name="materialId" type="hidden" value={material.id} />
          <p className="text-sm font-medium">Remove this course material?</p>
          <p className="mt-1 text-xs text-zinc-600">
            It will no longer be available to this course.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              className="border border-black px-3 py-1.5 text-sm hover:bg-zinc-100"
              disabled={pending}
              onClick={() => setConfirming(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="border border-black px-3 py-1.5 text-sm hover:bg-red-50 hover:text-red-700 disabled:text-zinc-500"
              disabled={pending}
              type="submit"
            >
              {pending ? "Removing…" : "Remove"}
            </button>
          </div>
          <ActionMessage state={state} />
        </form>
      ) : null}
    </article>
  );
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <path
        d="m4 20 4.25-1 10.5-10.5a2.12 2.12 0 0 0-3-3L5.25 16 4 20Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <path
        d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
