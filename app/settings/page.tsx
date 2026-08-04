export default function SettingsPage() {
  const sections = [
    ["Company Profile", "VTC Group entities, addresses and registration details"],
    ["Currencies & Rates", "Base currencies, pricing rules and Treasury limits"],
    ["Approval Matrix", "Commercial, Treasury, finance and management approvals"],
    ["Notifications", "Email, platform and escalation preferences"],
    ["Roles & Permissions", "Access controls for dealers, managers and administrators"],
    ["Integrations", "Accounting, banking, email, shipping and AI connections"],
  ];

  return (
    <main className="p-5 text-white md:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">Administration</p>
      <h2 className="mt-2 text-3xl font-bold">Platform Settings</h2>
      <p className="mt-2 text-sm text-slate-400">Configure the operating rules and integrations used across VTC ONE.</p>

      <section className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map(([title, detail]) => (
          <article key={title} className="rounded-2xl border border-slate-800 bg-[#0d1423] p-6">
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
            <button type="button" className="mt-5 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300">Configure</button>
          </article>
        ))}
      </section>
    </main>
  );
}
