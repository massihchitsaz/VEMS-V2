"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import {
  fxPositions,
  type FxPosition,
} from "@/lib/fx-positions";

type PositionDirection = "LONG" | "SHORT" | "BALANCED";

function getPositionDirection(
  position: FxPosition,
): PositionDirection {
  if (position.netPosition > 0) {
    return "LONG";
  }

  if (position.netPosition < 0) {
    return "SHORT";
  }

  return "BALANCED";
}

function formatAmount(
  amount: number,
  maximumFractionDigits = 0,
): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(Math.abs(amount));
}

function formatSignedAmount(amount: number): string {
  if (amount === 0) {
    return "0";
  }

  const formattedAmount = formatAmount(amount);

  return amount > 0
    ? `+${formattedAmount}`
    : `-${formattedAmount}`;
}

function formatRate(
  currency: string,
  rate: number,
): string {
  if (!Number.isFinite(rate) || rate <= 0) {
    return "-";
  }

  if (currency === "IRR") {
    return `1 AED = ${Math.round(1 / rate).toLocaleString(
      "en-US",
    )} IRR`;
  }

  return rate.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}

function getSuggestedRate(position: FxPosition): number {
  if (position.requiredAction === "BUY") {
    return position.targetBuyRate;
  }

  if (position.requiredAction === "SELL") {
    return position.targetSellRate;
  }

  return position.marketRate;
}

function getLimitRate(position: FxPosition): number {
  if (position.requiredAction === "BUY") {
    return position.maximumBuyRate;
  }

  if (position.requiredAction === "SELL") {
    return position.minimumSellRate;
  }

  return position.marketRate;
}

function getProjectedPosition(position: FxPosition): number {
  if (position.requiredAction === "BUY") {
    return position.netPosition + position.requiredAmount;
  }

  if (position.requiredAction === "SELL") {
    return position.netPosition - position.requiredAmount;
  }

  return position.netPosition;
}

function getRiskClasses(riskLevel: string): string {
  switch (riskLevel) {
    case "LOW":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";

    case "MEDIUM":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";

    case "HIGH":
      return "border-orange-500/30 bg-orange-500/10 text-orange-300";

    case "CRITICAL":
      return "border-red-500/30 bg-red-500/10 text-red-300";

    default:
      return "border-slate-500/30 bg-slate-500/10 text-slate-300";
  }
}

function getActionClasses(action: string): string {
  switch (action) {
    case "BUY":
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";

    case "SELL":
      return "border-purple-500/30 bg-purple-500/10 text-purple-300";

    default:
      return "border-slate-500/30 bg-slate-500/10 text-slate-300";
  }
}

function getDirectionClasses(
  direction: PositionDirection,
): string {
  switch (direction) {
    case "LONG":
      return "text-emerald-400";

    case "SHORT":
      return "text-red-400";

    default:
      return "text-slate-300";
  }
}

export default function FxPositionsPage() {
  const router = useRouter();

  const summary = useMemo(() => {
    const totalLongExposure = fxPositions.reduce(
      (total, position) =>
        total +
        (position.netPosition > 0
          ? position.netPosition
          : 0),
      0,
    );

    const totalShortExposure = fxPositions.reduce(
      (total, position) =>
        total +
        (position.netPosition < 0
          ? Math.abs(position.netPosition)
          : 0),
      0,
    );

    const requiredActionCount = fxPositions.filter(
      (position) =>
        position.requiredAction !== "HOLD",
    ).length;

    const criticalPositionCount = fxPositions.filter(
      (position) =>
        position.riskLevel === "CRITICAL",
    ).length;

    const settlementDueToday = fxPositions.reduce(
      (total, position) =>
        total + position.settlementDueToday,
      0,
    );

    return {
      totalLongExposure,
      totalShortExposure,
      requiredActionCount,
      criticalPositionCount,
      settlementDueToday,
    };
  }, []);

  function createDeal(position: FxPosition) {
    if (position.requiredAction === "HOLD") {
      return;
    }

    const suggestedRate = getSuggestedRate(position);
    const limitRate = getLimitRate(position);

    const params = new URLSearchParams({
      currency: position.currency,
      baseCurrency: position.baseCurrency,
      direction: position.requiredAction,
      amount: String(position.requiredAmount),
      suggestedRate: String(suggestedRate),
      limitRate: String(limitRate),
      source: "position-board",
      positionId: position.id,
      riskLevel: position.riskLevel,
    });

    router.push(
      `/fx/deals/new?${params.toString()}`,
    );
  }

  return (
    <main className="min-h-screen bg-[#060a12] p-5 text-white md:p-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-400">
              VTC Group Treasury Desk
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Treasury Position Board
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Monitor live currency exposure, required dealer
              action, approved rates and settlement risk.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-slate-800 bg-[#0d1423] px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Last Updated
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-200">
                Live Operational Data
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push("/fx/deals")}
              className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
            >
              View All Deals
            </button>
          </div>
        </header>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-5">
            <p className="text-sm text-slate-400">
              Long Exposure
            </p>

            <p className="mt-3 text-2xl font-bold text-emerald-400">
              {formatAmount(summary.totalLongExposure)}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Aggregate positive positions
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-5">
            <p className="text-sm text-slate-400">
              Short Exposure
            </p>

            <p className="mt-3 text-2xl font-bold text-red-400">
              {formatAmount(summary.totalShortExposure)}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Aggregate negative positions
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-5">
            <p className="text-sm text-slate-400">
              Required Actions
            </p>

            <p className="mt-3 text-2xl font-bold text-blue-400">
              {summary.requiredActionCount}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Buy or sell instructions
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-5">
            <p className="text-sm text-slate-400">
              Critical Positions
            </p>

            <p className="mt-3 text-2xl font-bold text-red-400">
              {summary.criticalPositionCount}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Immediate attention required
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-5">
            <p className="text-sm text-slate-400">
              Settlement Due Today
            </p>

            <p className="mt-3 text-2xl font-bold text-amber-300">
              {formatAmount(summary.settlementDueToday)}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Across all currencies
            </p>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          {fxPositions.map((position) => {
            const direction =
              getPositionDirection(position);

            const suggestedRate =
              getSuggestedRate(position);

            const limitRate =
              getLimitRate(position);

            const projectedPosition =
              getProjectedPosition(position);

            const isActionRequired =
              position.requiredAction !== "HOLD";

            return (
              <article
                key={position.id}
                className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1423] shadow-2xl shadow-black/10"
              >
                <div className="border-b border-slate-800 p-6">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-bold">
                          {position.currency}
                        </h2>

                        <span className="text-lg text-slate-500">
                          /
                        </span>

                        <span className="text-lg font-semibold text-slate-300">
                          {position.baseCurrency}
                        </span>
                      </div>

                      <p
                        className={`mt-2 text-sm font-semibold ${getDirectionClasses(
                          direction,
                        )}`}
                      >
                        {direction}{" "}
                        {formatAmount(
                          position.netPosition,
                        )}{" "}
                        {position.currency}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${getActionClasses(
                          position.requiredAction,
                        )}`}
                      >
                        {position.requiredAction}
                      </span>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${getRiskClasses(
                          position.riskLevel,
                        )}`}
                      >
                        {position.riskLevel} RISK
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-px bg-slate-800 sm:grid-cols-3">
                  <div className="bg-[#0d1423] p-5">
                    <p className="text-xs uppercase tracking-wider text-slate-500">
                      Position Before
                    </p>

                    <p
                      className={`mt-2 text-xl font-bold ${getDirectionClasses(
                        direction,
                      )}`}
                    >
                      {formatSignedAmount(
                        position.netPosition,
                      )}
                    </p>
                  </div>

                  <div className="bg-[#0d1423] p-5">
                    <p className="text-xs uppercase tracking-wider text-slate-500">
                      Required Amount
                    </p>

                    <p className="mt-2 text-xl font-bold text-white">
                      {formatAmount(
                        position.requiredAmount,
                      )}
                    </p>
                  </div>

                  <div className="bg-[#0d1423] p-5">
                    <p className="text-xs uppercase tracking-wider text-slate-500">
                      Position After
                    </p>

                    <p
                      className={`mt-2 text-xl font-bold ${getDirectionClasses(
                        projectedPosition > 0
                          ? "LONG"
                          : projectedPosition < 0
                            ? "SHORT"
                            : "BALANCED",
                      )}`}
                    >
                      {formatSignedAmount(
                        projectedPosition,
                      )}
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr]">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                      Position Breakdown
                    </h3>

                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <span className="text-sm text-slate-400">
                          Cash Balance
                        </span>

                        <span className="font-semibold">
                          {formatAmount(
                            position.cashBalance,
                          )}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <span className="text-sm text-slate-400">
                          Expected Receipts
                        </span>

                        <span className="font-semibold text-emerald-400">
                          +
                          {formatAmount(
                            position.expectedReceipts,
                          )}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <span className="text-sm text-slate-400">
                          Open Purchases
                        </span>

                        <span className="font-semibold text-emerald-400">
                          +
                          {formatAmount(
                            position.openPurchases,
                          )}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <span className="text-sm text-slate-400">
                          Expected Payments
                        </span>

                        <span className="font-semibold text-red-400">
                          -
                          {formatAmount(
                            position.expectedPayments,
                          )}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">
                          Open Sales
                        </span>

                        <span className="font-semibold text-red-400">
                          -
                          {formatAmount(
                            position.openSales,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                      Treasury Pricing
                    </h3>

                    <div className="mt-4 space-y-3">
                      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                        <p className="text-xs text-slate-500">
                          Market Rate
                        </p>

                        <p className="mt-2 text-lg font-bold">
                          {formatRate(
                            position.currency,
                            position.marketRate,
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
                        <p className="text-xs text-blue-200/70">
                          Suggested Dealer Rate
                        </p>

                        <p className="mt-2 text-lg font-bold text-blue-300">
                          {formatRate(
                            position.currency,
                            suggestedRate,
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                        <p className="text-xs text-amber-200/70">
                          Treasury Limit
                        </p>

                        <p className="mt-2 text-lg font-bold text-amber-300">
                          {formatRate(
                            position.currency,
                            limitRate,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 border-t border-slate-800 bg-slate-950/30 p-6 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500">
                      Open Deals
                    </p>

                    <p className="mt-2 text-lg font-bold">
                      {position.openDeals}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500">
                      Due Today
                    </p>

                    <p className="mt-2 text-lg font-bold text-amber-300">
                      {formatAmount(
                        position.settlementDueToday,
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500">
                      Updated
                    </p>

                    <p className="mt-2 text-sm font-semibold text-slate-300">
                      {new Date(
                        position.updatedAt,
                      ).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-800 p-6">
                  <button
                    type="button"
                    disabled={!isActionRequired}
                    onClick={() => createDeal(position)}
                    className={`w-full rounded-xl px-5 py-4 font-semibold text-white transition ${
                      isActionRequired
                        ? "bg-blue-600 hover:bg-blue-500"
                        : "cursor-not-allowed bg-slate-800 text-slate-500"
                    }`}
                  >
                    {isActionRequired
                      ? `Create ${position.requiredAction} Deal`
                      : "No Deal Required"}
                  </button>

                  <p className="mt-3 text-center text-xs text-slate-500">
                    {isActionRequired
                      ? "Currency, amount, direction and approved rates will be transferred to the Deal Ticket."
                      : "The current position is within the required operating range."}
                  </p>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}