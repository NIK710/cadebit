import Link from "next/link";
import type { ReactNode } from "react";

import { logoutAction } from "@/app/actions/auth";
import type { SessionUser } from "@/lib/session";

const navigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/courses", label: "Courses" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({
  children,
  user,
}: {
  children: ReactNode;
  user: SessionUser;
}) {
  return (
    <div className="min-h-screen bg-white text-black">
      <header className="border-b border-black">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link className="text-lg font-bold tracking-tight" href="/dashboard">
            CadeBit
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-zinc-600 sm:inline">{user.name}</span>
            <form action={logoutAction}>
              <button
                className="border border-black px-3 py-1.5 hover:bg-zinc-100"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl md:grid-cols-[180px_1fr]">
        <nav
          aria-label="Primary navigation"
          className="flex gap-2 border-b border-black p-4 md:min-h-[calc(100vh-65px)] md:flex-col md:border-r md:border-b-0"
        >
          {navigation.map((item) => (
            <Link
              className="border border-transparent px-3 py-2 text-sm font-medium hover:border-black hover:bg-zinc-100"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="min-w-0 p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
