"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  getFxDeals,
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

export default function FxDealBlotter() {
  const router = useRouter();

  const [deals, setDeals] = useState<FxDeal[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | FxDealStatus>("all");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadDeals() {
    setLoading(true);
    setErrorMessage("");

    try {
      const data = await getFxDeals();
      setDeals(data);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load FX deals."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDeals();
  }, []);

  const filteredDeals = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return deals.filter((deal) => {
      const matchesSearch =
        !normalizedSearch ||
        deal.deal_no.toLowerCase().includes(normalizedSearch) ||
        deal.counterparty_name.toLowerCase().includes(normalizedSearch) ||
        deal.base_currency.toLowerCase().includes(normalizedSearch) ||
        deal.quote_currency.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        status === "all" || deal.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [deals, search, status]);

  const summary = useMemo(() => {
    const openDeals = deals.filter(
      (deal) =>
        deal.status !== "settled" &&
        deal.status !== "cancelled"
    ).length;

    const pendingApprovals = deals.filter(
      (deal) => deal.status === "pending_approval"
    ).length;

    const totalProfit = deals.reduce(
      (total, deal) => total + Number(deal.expected_profit ?? 0),
      0
    );

    const totalVolume = deals.reduce(
      (total, deal) => total + Number(deal.base_amount ?? 0),
      0
    );

    return {
      openDeals,
      pendingApprovals,
      totalProfit,
      totalVolume,
    };
  }, [deals]);

  return (
    <main className="min-h-screen min-w-0 overflow-x-hidden bg-[#060a12] p-5 text-white md:p-8">
      <header className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-400">
            VTC GROUP FX TRADING DESK
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            FX Deal Blotter
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Live control of foreign-exchange transactions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push("/fx/deals/new")}
          className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold transition hover:bg-blue-500"
        >
          + New FX Deal
        </button>
      </header>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Deals"
          value={formatNumber(deals.length, 0)}
        />

        <SummaryCard
          label="Open Deals"
          value={formatNumber(summary.openDeals, 0)}
        />

        <SummaryCard
          label="Pending Approval"
          value={formatNumber(summary.pendingApprovals, 0)}
        />

        <SummaryCard
          label="Recorded P/L"
          value={formatNumber(summary.totalProfit, 2)}
          positive={summary.totalProfit >= 0}
        />
      </section>

      <section className="mb-5 rounded-xl border border-white/10 bg-[#0d1422] p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_230px_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search deal, counterparty or currency..."
            className="rounded-lg border border-white/10 bg-[#080d17] px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-blue-500"
          />

          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as "all" | FxDealStatus)
            }
            className="rounded-lg border border-white/10 bg-[#080d17] px-4 py-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
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

          <button
            type="button"
            onClick={() => void loadDeals()}
            className="rounded-lg border border-white/10 px-5 py-3 text-sm text-slate-300 transition hover:bg-white/5"
          >
            Refresh
          </button>
        </div>
      </section>

      {errorMessage && (
        <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errorMessage}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0d1422]">
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-[#101827] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-4">Deal Number</th>
                <th className="px-5 py-4">Trade Date</th>
                <th className="px-5 py-4">Type</th>
                <th className="px-5 py-4">Currency Pair</th>
                <th className="px-5 py-4">Counterparty</th>
                <th className="px-5 py-4 text-right">Base Amount</th>
                <th className="px-5 py-4 text-right">Agreed Rate</th>
                <th className="px-5 py-4 text-right">Market Rate</th>
                <th className="px-5 py-4 text-right">Expected P/L</th>
                <th className="px-5 py-4">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-14 text-center text-slate-400"
                  >
                    Loading FX deals...
                  </td>
                </tr>
              ) : filteredDeals.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-14 text-center text-slate-400"
                  >
                    No FX deals found.
                  </td>
                </tr>
              ) : (
                filteredDeals.map((deal) => (
                  <tr
                    key={deal.id}
                    className="cursor-pointer transition hover:bg-white/3"
                    onClick={() =>
                      router.push(`/fx/deals/${deal.id}`)
                    }
                  >
                    <td className="px-5 py-4 font-semibold text-blue-300">
                      {deal.deal_no}
                    </td>

                    <td className="px-5 py-4 text-slate-300">
                      {formatDate(deal.trade_date)}
                    </td>

                    <td className="px-5 py-4">
                      <DealTypeBadge type={deal.deal_type} />
                    </td>

                    <td className="px-5 py-4 font-semibold">
                      {deal.base_currency}/{deal.quote_currency}
                    </td>

                    <td className="px-5 py-4 text-slate-300">
                      {deal.counterparty_name}
                    </td>

                    <td className="px-5 py-4 text-right font-medium">
                      {deal.base_currency}{" "}
                      {formatNumber(deal.base_amount, 2)}
                    </td>

                    <td className="px-5 py-4 text-right">
                      {formatRate(deal.agreed_rate)}
                    </td>

                    <td className="px-5 py-4 text-right text-slate-400">
                      {deal.market_rate
                        ? formatRate(deal.market_rate)
                        : "—"}
                    </td>

                    <td
                      className={`px-5 py-4 text-right font-semibold ${
                        Number(deal.expected_profit ?? 0) >= 0
                          ? "text-emerald-300"
                          : "text-red-300"
                      }`}
                    >
                      {deal.quote_currency}{" "}
                      {formatNumber(
                        Number(deal.expected_profit ?? 0),
                        2
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge status={deal.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-4 text-xs text-slate-500">
        Showing {filteredDeals.length} of {deals.length} deals
      </p>
    </main>
  );
}

function SummaryCard({
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

      <p className={`mt-2 text-2xl font-bold ${valueClass}`}>
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
      className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${styles}`}
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
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function formatNumber(
  value: number,
  maximumFractionDigits: number
) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: maximumFractionDigits,
    maximumFractionDigits,
  });
}

function formatRate(value: number) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 8,
  });
}

function formatDate(value: string) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}
