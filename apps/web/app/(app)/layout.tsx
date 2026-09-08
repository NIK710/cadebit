import type { ReactNode } from "react";

import { requireSession } from "@/lib/session";

import { AppShell } from "./app-shell";
import { CourseProvider } from "./course-provider";

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireSession();

  return (
    <CourseProvider userId={session.userId}>
      <AppShell user={session}>{children}</AppShell>
    </CourseProvider>
  );
}
