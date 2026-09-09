"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      className="border border-black px-3 py-1.5 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-500"
      disabled={pending}
      onClick={handleLogout}
      type="button"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
