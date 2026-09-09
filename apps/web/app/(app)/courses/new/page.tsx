import { CourseForm } from "./course-form";

export default function NewCoursePage() {
  return (
    <div className="max-w-2xl space-y-7">
      <header>
        <p className="text-sm text-zinc-600">New study space</p>
        <h1 className="mt-1 text-3xl font-semibold">Create a course</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Create a private independent course or a shared course that students
          can join using a six-character code.
        </p>
      </header>
      <section className="border border-black p-5 sm:p-7">
        <CourseForm />
      </section>
    </div>
  );
}
