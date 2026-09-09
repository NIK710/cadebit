"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const passwordConfirmation = String(
      formData.get("passwordConfirmation") ?? "",
    );
    if (password !== passwordConfirmation) {
      setError("Passwords do not match.");
      return;
    }

    setPending(true);
    const result = await authClient.signUp.email({
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      password,
    });

    if (result.error) {
      setError(result.error.message || "Unable to create the account.");
      setPending(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <Field label="Name" name="name" autoComplete="name" required />
      <Field
        label="Email"
        name="email"
        autoComplete="email"
        type="email"
        required
      />
      <Field
        label="Password"
        name="password"
        autoComplete="new-password"
        type="password"
        minLength={8}
        maxLength={128}
        required
      />
      <Field
        label="Confirm password"
        name="passwordConfirmation"
        autoComplete="new-password"
        type="password"
        minLength={8}
        maxLength={128}
        required
      />

      {error ? (
        <p
          className="border border-black bg-zinc-100 px-3 py-2 text-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button
        className="w-full border border-black bg-black px-4 py-2 font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-500"
        type="submit"
        disabled={pending}
      >
        {pending ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-sm text-zinc-600">
        Already have an account?{" "}
        <Link
          className="font-medium text-black underline underline-offset-4"
          href="/login"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium" htmlFor={name}>
        {label}
      </label>
      <input
        className="w-full border border-black bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-black"
        id={name}
        name={name}
        {...props}
      />
    </div>
  );
}
