import { requireSession } from "@/lib/session";

export default async function SettingsPage() {
  const session = await requireSession();

  return (
    <div className="max-w-2xl space-y-7">
      <header>
        <p className="text-sm text-zinc-600">Account and preferences</p>
        <h1 className="mt-1 text-3xl font-semibold">Settings</h1>
      </header>

      <section className="border border-black">
        <h2 className="border-b border-black bg-zinc-100 px-5 py-3 font-semibold">
          Account
        </h2>
        <dl className="divide-y divide-zinc-300">
          <SettingRow label="Name" value={session.name} />
          <SettingRow label="Email" value={session.email} />
          <SettingRow label="Account type" value="Local development account" />
        </dl>
      </section>

      <section className="border border-black p-5">
        <h2 className="font-semibold">Data during Phase 1</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Course changes are scoped to this account and stored in this browser.
          The PostgreSQL model in Phase 2 will provide durable,
          server-authorized storage.
        </p>
      </section>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 px-5 py-4 sm:grid-cols-[160px_1fr]">
      <dt className="text-sm text-zinc-600">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}
