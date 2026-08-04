"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  getFxDealById,
  updateFxDealStatus,
  type FxDeal,
  type FxDealStatus,
} from "../../lib/fx-deals";

const statusLabels: Record<FxDealStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  partially_settled: "Partially Settled",
  settled: "Settled",
  cancelled: "Cancelled",
};

export default function FxDealWorkspace() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const dealId = params.id;

  const [deal, setDeal] = useState<FxDeal | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadDeal() {
      setLoading(true);
      setErrorMessage("");

      try {
        const data = await getFxDealById(dealId);
        setDeal(data);
      } catch (error) {
        console.error(error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load FX deal."
        );
      } finally {
        setLoading(false);
      }
    }

    if (dealId) {
      void loadDeal();
    }
  }, [dealId]);

  async function handleStatusChange(status: FxDealStatus) {
    if (!deal || status === deal.status) return;

    setSavingStatus(true);
    setErrorMessage("");

    try {
      const updatedDeal = await updateFxDealStatus(deal.id, status);
      setDeal(updatedDeal);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update deal status."
      );
    } finally {
      setSavingStatus(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#060a12] p-8 text-white">
        <div className="rounded-xl border border-white/10 bg-[#0d1422] p-12 text-center text-slate-400">
          Loading FX deal...
        </div>
      </main>
    );
  }

  if (!deal) {
    return (
      <main className="min-h-screen bg-[#060a12] p-8 text-white">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-8 text-red-300">
          {errorMessage || "FX deal was not found."}
        </div>
      </main>
    );
  }

  const expectedProfit = Number(deal.expected_profit ?? 0);
  const quoteAmount = Number(deal.quote_amount ?? 0);
  const spread = Number(deal.spread ?? 0);

  return (
    <main className="min-h-screen min-w-0 overflow-x-hidden bg-[#060a12] p-5 text-white md:p-8">
      <header className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <button
            type="button"
            onClick={() => router.push("/fx/deals")}
            className="mb-4 text-sm text-slate-400 transition hover:text-white"
          >
            ← Back to FX Deal Blotter
          </button>

          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-400">
            VTC GROUP FX TRADING DESK
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">
              {deal.deal_no}
            </h1>

            <StatusBadge status={deal.status} />

            <DealTypeBadge type={deal.deal_type} />
          </div>

          <p className="mt-2 text-sm text-slate-400">
            {deal.base_currency}/{deal.quote_currency} transaction with{" "}
            {deal.counterparty_name}
          </p>
        </div>
        <button
  type="button"
  onClick={() =>
    router.push(`/fx/deals/${deal.id}/quotes`)
  }
className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold transition hover:bg-blue-500">
  Open Quote Sheet
</button>
        <div className="min-w-60">
          <label className="mb-2 block text-xs uppercase tracking-wide text-slate-500">
            Deal Status
          </label>

          <select
            value={deal.status}
            disabled={savingStatus}
            onChange={(event) =>
              void handleStatusChange(
                event.target.value as FxDealStatus
              )
            }
            className="w-full rounded-lg border border-white/10 bg-[#080d17] px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
          >
            <option value="draft">Draft</option>
            <option value="pending_approval">
              Pending Approval
            </option>
            <option value="approved">Approved</option>
            <option value="partially_settled">
              Partially Settled
            </option>
            <option value="settled">Settled</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </header>

      {errorMessage && (
        <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errorMessage}
        </div>
      )}

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Base Amount"
          value={`${deal.base_currency} ${formatNumber(
            deal.base_amount,
            2
          )}`}
        />

        <MetricCard
          label="Quote Amount"
          value={`${deal.quote_currency} ${formatNumber(
            quoteAmount,
            2
          )}`}
        />

        <MetricCard
          label="Agreed Rate"
          value={formatRate(deal.agreed_rate)}
        />

        <MetricCard
          label="Expected P/L"
          value={`${deal.quote_currency} ${formatNumber(
            expectedProfit,
            2
          )}`}
          positive={expectedProfit >= 0}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          <Section title="Transaction Details">
            <Detail label="Deal Type" value={deal.deal_type.toUpperCase()} />
            <Detail
              label="Currency Pair"
              value={`${deal.base_currency}/${deal.quote_currency}`}
            />
            <Detail
              label="Counterparty"
              value={deal.counterparty_name}
            />
            <Detail
              label="Counterparty Type"
              value={formatText(deal.counterparty_type)}
            />
            <Detail
              label="Trade Date"
              value={formatDate(deal.trade_date)}
            />
            <Detail
              label="Value Date"
              value={formatDate(deal.value_date)}
            />
          </Section>

          <Section title="Pricing & Rate Control">
            <Detail
              label="Market Rate"
              value={
                deal.market_rate
                  ? formatRate(deal.market_rate)
                  : "Not recorded"
              }
            />
            <Detail
              label="Agreed Rate"
              value={formatRate(deal.agreed_rate)}
            />
            <Detail
              label="Rate Spread"
              value={formatRate(spread)}
            />
            <Detail
              label="Expected P/L"
              value={`${deal.quote_currency} ${formatNumber(
                expectedProfit,
                2
              )}`}
              valueClass={
                expectedProfit >= 0
                  ? "text-emerald-300"
                  : "text-red-300"
              }
            />
          </Section>

          <Section title="Settlement Instructions">
            <Detail
              label="Settlement Date"
              value={formatDate(deal.settlement_date)}
            />
            <Detail
              label="Payment Account"
              value={deal.payment_account || "Not recorded"}
            />
            <Detail
              label="Receiving Account"
              value={deal.receiving_account || "Not recorded"}
            />
            <Detail
              label="Last Updated"
              value={formatDateTime(deal.updated_at)}
            />
          </Section>

          <section className="rounded-xl border border-white/10 bg-[#0d1422] p-6">
            <h2 className="text-lg font-semibold">Internal Notes</h2>

            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">
              {deal.notes || "No internal notes have been recorded."}
            </p>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-white/10 bg-[#0d1422] p-6">
            <h2 className="text-lg font-semibold">Deal Timeline</h2>

            <div className="mt-6 space-y-6">
              <TimelineItem
                title="Deal Created"
                date={formatDateTime(deal.created_at)}
                description="The FX transaction was registered."
              />

              <TimelineItem
                title="Last Updated"
                date={formatDateTime(deal.updated_at)}
                description={`Current status: ${
                  statusLabels[deal.status]
                }`}
              />

              {deal.approved_by && (
                <TimelineItem
                  title="Management Approval"
                  date="Approval recorded"
                  description="The transaction was approved."
                />
              )}
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-[#0d1422] p-6">
            <h2 className="text-lg font-semibold">Risk Snapshot</h2>

            <div className="mt-5 space-y-4">
              <RiskRow
                label="Market Variance"
                value={
                  deal.market_rate
                    ? `${(
                        ((Number(deal.agreed_rate) -
                          Number(deal.market_rate)) /
                          Number(deal.market_rate)) *
                        100
                      ).toFixed(4)}%`
                    : "Not available"
                }
              />

              <RiskRow
                label="Settlement Exposure"
                value={`${deal.quote_currency} ${formatNumber(
                  quoteAmount,
                  2
                )}`}
              />

              <RiskRow
                label="Approval State"
                value={statusLabels[deal.status]}
              />
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#0d1422] p-6">
      <h2 className="text-lg font-semibold">{title}</h2>

      <div className="mt-6 grid gap-x-8 gap-y-6 md:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function Detail({
  label,
  value,
  valueClass = "text-white",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className={`mt-2 text-sm font-medium ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  const valueClass =
    positive === undefined
      ? "text-white"
      : positive
        ? "text-emerald-300"
        : "text-red-300";

  return (
    <div className="rounded-xl border border-white/10 bg-[#0d1422] p-5">
      <p className="text-sm text-slate-400">{label}</p>

      <p className={`mt-2 text-xl font-bold ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

function DealTypeBadge({
  type,
}: {
  type: FxDeal["deal_type"];
}) {
  const styles =
    type === "buy"
      ? "bg-blue-500/15 text-blue-300"
      : type === "sell"
        ? "bg-amber-500/15 text-amber-300"
        : "bg-purple-500/15 text-purple-300";

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${styles}`}
    >
      {type}
    </span>
  );
}

function StatusBadge({
  status,
}: {
  status: FxDealStatus;
}) {
  const styles: Record<FxDealStatus, string> = {
    draft: "bg-slate-500/15 text-slate-300",
    pending_approval: "bg-amber-500/15 text-amber-300",
    approved: "bg-blue-500/15 text-blue-300",
    partially_settled: "bg-purple-500/15 text-purple-300",
    settled: "bg-emerald-500/15 text-emerald-300",
    cancelled: "bg-red-500/15 text-red-300",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function TimelineItem({
  title,
  date,
  description,
}: {
  title: string;
  date: string;
  description: string;
}) {
  return (
    <div className="relative border-l border-white/10 pl-5">
      <span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-blue-500" />

      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs text-blue-300">{date}</p>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </div>
  );
}

function RiskRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-4 last:border-0 last:pb-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-right text-sm font-semibold">{value}</span>
    </div>
  );
}

function formatNumber(value: number, fractionDigits: number) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatRate(value: number) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 8,
  });
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatText(value: string | null) {
  if (!value) return "Not recorded";

  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
