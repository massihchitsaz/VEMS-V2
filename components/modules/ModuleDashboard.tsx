import Link from "next/link";

export type ModuleMetric = {
  label: string;
  value: string;
  detail: string;
  tone?: "blue" | "green" | "amber" | "red" | "purple";
};

export type ModuleAction = {
  label: string;
  href: string;
  description: string;
};

const toneClasses: Record<NonNullable<ModuleMetric["tone"]>, string> = {
  blue: "text-blue-400",
  green: "text-emerald-400",
  amber: "text-amber-300",
  red: "text-red-400",
  purple: "text-purple-400",
};

export function ModuleDashboard({
  eyebrow,
  title,
  description,
  metrics,
  actions,
  rows,
}: {
  eyebrow: string;
  title: string;
  description: string;
  metrics: ModuleMetric[];
  actions: ModuleAction[];
  rows?: Array<Record<string, string>>;
}) {
  const headers = rows?.length ? Object.keys(rows[0]) : [];

  return (
    <main className="p-5 text-white md:p-8">
      <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-3xl font-bold">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">{description}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {actions.slice(0, 2).map((action, index) => (
            <Link
              key={action.href}
              href={action.href}
              className={
                index === 0
                  ? "rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
                  : "rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
              }
            >
              {action.label}
            </Link>
          ))}
        </div>
      </header>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-2xl border border-slate-800 bg-[#0d1423] p-5">
            <p className="text-sm text-slate-400">{metric.label}</p>
            <p className={`mt-4 text-3xl font-bold ${toneClasses[metric.tone ?? "blue"]}`}>
              {metric.value}
            </p>
            <p className="mt-2 text-xs text-slate-500">{metric.detail}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-6">
          <h3 className="text-xl font-semibold">Operational Overview</h3>
          <p className="mt-1 text-sm text-slate-400">Current records requiring management attention.</p>

          {rows?.length ? (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-slate-800 text-xs uppercase text-slate-500">
                  <tr>
                    {headers.map((header) => (
                      <th key={header} className="px-3 py-3 font-medium">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index} className="border-b border-slate-800/80 last:border-0">
                      {headers.map((header) => (
                        <td key={header} className="px-3 py-4 text-slate-300 first:font-semibold first:text-white">
                          {row[header]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-950/30 p-8 text-center text-sm text-slate-500">
              No operational records available.
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-6">
          <h3 className="text-xl font-semibold">Quick Actions</h3>
          <div className="mt-5 space-y-3">
            {actions.map((action, index) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4 transition hover:border-blue-500/40"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold">
                  {index + 1}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">{action.label}</span>
                  <span className="mt-1 block text-xs text-slate-500">{action.description}</span>
                </span>
              </Link>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
