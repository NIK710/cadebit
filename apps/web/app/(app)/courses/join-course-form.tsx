"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { joinCourseAction } from "./actions";

export function JoinCourseForm() {
  const [state, action] = useActionState(joinCourseAction, {});

  return (
    <form action={action} className="border border-black p-5">
      <h2 className="text-lg font-semibold">Join a shared course</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Ask a course admin for its six-character code.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <input
          aria-label="Course join code"
          autoCapitalize="characters"
          className="min-w-44 flex-1 border border-black px-3 py-2 font-mono uppercase tracking-[0.25em] outline-none focus:ring-2 focus:ring-black"
          maxLength={6}
          name="joinCode"
          pattern="[A-HJ-NP-Za-hj-np-z2-9]{6}"
          placeholder="ABC234"
          required
        />
        <JoinButton />
      </div>
      {state.error ? (
        <p className="mt-3 text-sm" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function JoinButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="border border-black bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-600"
      disabled={pending}
      type="submit"
    >
      {pending ? "Joining…" : "Join course"}
    </button>
  );
}
