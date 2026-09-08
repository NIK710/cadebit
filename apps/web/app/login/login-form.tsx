"use client";

import { useActionState } from "react";

import { loginAction, type LoginState } from "@/app/actions/auth";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          className="w-full border border-black bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-black"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          className="w-full border border-black bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-black"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {state.error ? (
        <p
          className="border border-black bg-zinc-100 px-3 py-2 text-sm"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <button
        className="w-full border border-black bg-black px-4 py-2 font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-500"
        type="submit"
        disabled={pending}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
