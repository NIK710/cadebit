"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { useCourses } from "../../course-provider";

export function CourseForm() {
  const router = useRouter();
  const { createCourse } = useCourses();
  const [error, setError] = useState<string>();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const targetDate = String(formData.get("targetDate") ?? "");
    const topicOutline = String(formData.get("topicOutline") ?? "");

    if (name.length < 2) {
      setError("Course name must contain at least two characters.");
      return;
    }

    const course = createCourse({
      name,
      description,
      targetDate,
      topicOutline,
    });
    router.push(`/courses/${course.id}`);
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <Field label="Course name" name="name" required placeholder="ECE 313" />
      <Field
        label="Description"
        name="description"
        placeholder="What this course covers"
      />
      <Field label="Target completion date" name="targetDate" type="date" />

      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="topicOutline">
          Initial topics and subtopics
        </label>
        <textarea
          className="min-h-36 w-full border border-black bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-black"
          id="topicOutline"
          name="topicOutline"
          placeholder={
            "Probability Foundations > Sample Spaces\nProbability Foundations > Bayes' Rule\nRandom Variables > PMFs"
          }
        />
        <p className="text-xs text-zinc-600">
          Add one item per line using Topic &gt; Subtopic.
        </p>
      </div>

      {error ? (
        <p
          className="border border-black bg-zinc-100 px-3 py-2 text-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          className="border border-black bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          type="submit"
        >
          Create course
        </button>
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
