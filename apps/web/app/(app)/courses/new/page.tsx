import { CourseForm } from "./course-form";

export default function NewCoursePage() {
  return (
    <div className="max-w-2xl space-y-7">
      <header>
        <p className="text-sm text-zinc-600">Independent course</p>
        <h1 className="mt-1 text-3xl font-semibold">Create a course</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Start with the basic structure. Materials, sharing, and detailed
          scheduling arrive in later phases.
        </p>
      </header>
      <section className="border border-black p-5 sm:p-7">
        <CourseForm />
      </section>
    </div>
  );
}
