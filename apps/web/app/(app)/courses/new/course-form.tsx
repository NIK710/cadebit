"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { createCourseAction } from "../actions";

export function CourseForm() {
  const router = useRouter();
  const [state, action] = useActionState(createCourseAction, {});

  return (
    <form action={action} className="space-y-6">
      <Field label="Course name" name="name" required placeholder="ECE 313" />
      <Field
        label="Description"
        name="description"
        placeholder="What this course covers"
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Course type</legend>
        <label className="flex items-start gap-3 border border-black p-3">
          <input defaultChecked name="type" type="radio" value="independent" />
          <span>
            <span className="block font-medium">Independent</span>
            <span className="block text-xs text-zinc-600">
              A private course only you can access.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 border border-black p-3">
          <input name="type" type="radio" value="shared" />
          <span>
            <span className="block font-medium">Shared</span>
            <span className="block text-xs text-zinc-600">
              Creates a six-character code that other students can join.
            </span>
          </span>
        </label>
      </fieldset>

      <Field
        label="Your target completion date"
        name="targetDate"
        type="date"
      />

      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="topicOutline">
          Course outline (optional)
        </label>
        <p className="text-xs leading-5 text-zinc-600">
          Paste an outline from your syllabus, course topics, or chapter list.
          Leave this blank and CadeBit can generate a suggested initial outline
          from your course materials.
        </p>
        <textarea
          className="min-h-52 w-full border border-black bg-white px-3 py-2 font-mono text-sm leading-6 outline-none focus:ring-2 focus:ring-black"
          id="topicOutline"
          maxLength={50_000}
          name="topicOutline"
          placeholder={
            "Chapter 1: Probability Foundations\n  - Sample Spaces\n  - Counting\n  - Conditional Probability\n    - Bayes' Rule\n\nChapter 2: Random Variables\n  - PMFs\n  - CDFs\n  - Expectation"
          }
        />
        <p className="text-xs text-zinc-600">
          Indentation and optional bullets define up to three levels. You can
          edit the structure later.
        </p>
      </div>

      {state.error ? <FormMessage error>{state.error}</FormMessage> : null}

      <div className="flex flex-wrap gap-3">
        <SubmitButton>Create course</SubmitButton>
        <button
          className="border border-black px-4 py-2 text-sm font-medium hover:bg-zinc-100"
          onClick={() => router.back()}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  ...inputProps
}: {
  label: string;
  name: string;
  type?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "type">) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium" htmlFor={name}>
        {label}
      </label>
      <input
        className="w-full border border-black bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-black"
        id={name}
        name={name}
        type={type}
        {...inputProps}
      />
    </div>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="border border-black bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-600"
      disabled={pending}
      type="submit"
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

function FormMessage({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <p
      className="border border-black bg-zinc-100 px-3 py-2 text-sm"
      role={error ? "alert" : "status"}
    >
      {children}
    </p>
  );
}
