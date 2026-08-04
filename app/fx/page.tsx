import Link from "next/link";

import { fxPositions } from "@/lib/fx-positions";

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
}

export default function FxDashboardPage() {
  const buyRequirements = fxPositions.filter(
    (position) => position.requiredAction === "BUY",
  );
  const sellRequirements = fxPositions.filter(
    (position) => position.requiredAction === "SELL",
  );
  const highRiskPositions = fxPositions.filter(
    (position) =>
      position.riskLevel === "HIGH" || position.riskLevel === "CRITICAL",
  );

  return (
    <main className="p-5 text-white md:p-8">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">
            VTC Treasury Desk
          </p>
          <h2 className="mt-2 text-3xl font-bold">FX Trading Dashboard</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Central view of currency requirements, dealer actions, open deals and Treasury controls.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/fx/positions"
            className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-200"
          >
            Position Board
          </Link>
          <Link
            href="/fx/deals/new"
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500"
          >
            + Create FX Deal
          </Link>
        </div>
      </div>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-5">
          <p className="text-sm text-slate-400">Currencies Monitored</p>
          <p className="mt-4 text-3xl font-bold">{fxPositions.length}</p>
          <p className="mt-2 text-xs text-slate-500">USD, IRR, EUR and CNY</p>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-5">
          <p className="text-sm text-slate-400">Buy Requirements</p>
          <p className="mt-4 text-3xl font-bold text-blue-400">
            {buyRequirements.length}
          </p>
          <p className="mt-2 text-xs text-slate-500">Short positions requiring coverage</p>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-5">
          <p className="text-sm text-slate-400">Sell Requirements</p>
          <p className="mt-4 text-3xl font-bold text-purple-400">
            {sellRequirements.length}
          </p>
          <p className="mt-2 text-xs text-slate-500">Long positions available for sale</p>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-5">
          <p className="text-sm text-slate-400">High-Risk Positions</p>
          <p className="mt-4 text-3xl font-bold text-red-400">
            {highRiskPositions.length}
          </p>
          <p className="mt-2 text-xs text-slate-500">Immediate dealer attention required</p>
        </article>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold">Dealer Action Board</h3>
              <p className="mt-1 text-sm text-slate-400">
                Current instructions generated from Treasury positions.
              </p>
            </div>
            <Link href="/fx/positions" className="text-sm font-semibold text-blue-400">
              Open Board →
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {fxPositions.map((position) => (
              <div
                key={position.id}
                className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4 md:grid-cols-[0.7fr_1fr_1fr_0.8fr] md:items-center"
              >
                <div>
                  <p className="text-lg font-bold">{position.currency}/{position.baseCurrency}</p>
                  <p className="mt-1 text-xs text-slate-500">{position.riskLevel} risk</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Net Position</p>
                  <p className={position.netPosition < 0 ? "mt-1 font-semibold text-red-400" : "mt-1 font-semibold text-emerald-400"}>
                    {position.netPosition < 0 ? "-" : "+"}{formatAmount(position.netPosition)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Required Amount</p>
                  <p className="mt-1 font-semibold">{formatAmount(position.requiredAmount)}</p>
                </div>
                <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${
                  position.requiredAction === "BUY"
                    ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                    : position.requiredAction === "SELL"
                      ? "border-purple-500/30 bg-purple-500/10 text-purple-300"
                      : "border-slate-500/30 bg-slate-500/10 text-slate-300"
                }`}>
                  {position.requiredAction}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-6">
          <h3 className="text-xl font-semibold">Quick Workflow</h3>
          <p className="mt-1 text-sm text-slate-400">
            Move through the complete FX transaction process.
          </p>

          <div className="mt-5 space-y-3">
            {[
              ["1", "Review positions", "/fx/positions"],
              ["2", "Create deal ticket", "/fx/deals/new"],
              ["3", "Review approvals", "/approvals"],
              ["4", "Open deal blotter", "/fx/deals"],
              ["5", "Management reports", "/reports"],
            ].map(([number, label, href]) => (
              <Link
                key={number}
                href={href}
                className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4 transition hover:border-blue-500/40"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold">
                  {number}
                </span>
                <span className="text-sm font-semibold">{label}</span>
              </Link>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
