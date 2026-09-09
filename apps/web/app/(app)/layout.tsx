import type { ReactNode } from "react";

import { requireSession } from "@/lib/session";

import { AppShell } from "./app-shell";

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireSession();

  return <AppShell user={session}>{children}</AppShell>;
}
