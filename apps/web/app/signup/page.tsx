import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";

import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  if (await getSession()) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-12 text-black">
      <section className="w-full max-w-md border border-black p-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest">
          CadeBit
        </p>
        <h1 className="text-3xl font-semibold">Create your account</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Your courses and learning state will be scoped to this account.
        </p>
        <div className="mt-8">
          <SignupForm />
        </div>
      </section>
    </main>
  );
}
