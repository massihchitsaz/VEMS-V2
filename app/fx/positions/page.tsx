"use client";

import { useRouter } from "next/navigation";
import { fxPositions } from "@/lib/fx-positions";

export default function FxPositionsPage() {
    const router = useRouter();

  return (
    <main className="min-h-screen bg-[#070b14] p-8 text-white">
      <h1 className="text-3xl font-bold">
        Treasury Position Board
      </h1>

      <p className="mt-2 text-slate-400">
        Live Currency Positions
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {fxPositions.map((position) => (
          <div
            key={position.id}
            className="rounded-2xl border border-slate-700 bg-slate-900 p-6"
          >
            <div className="flex items-center justify-between">

              <div>

                <h2 className="text-2xl font-bold">
                  {position.currency}
                </h2>

                <p className="text-slate-400">
                  {position.baseCurrency}
                </p>

              </div>

              <div className="rounded-lg bg-blue-600 px-4 py-2">

                {position.requiredAction}

              </div>

            </div>

            <div className="mt-6 space-y-2">

              <p>
                Net Position:
                <strong className="ml-2">
                  {position.netPosition.toLocaleString()}
                </strong>
              </p>

              <p>
                Required Amount:
                <strong className="ml-2">
                  {position.requiredAmount.toLocaleString()}
                </strong>
              </p>

              <p>
                Market Rate:
                <strong className="ml-2">
                  {position.marketRate}
                </strong>
              </p>

              <p>
                Target Buy:
                <strong className="ml-2">
                  {position.targetBuyRate}
                </strong>
              </p>

              <p>
                Max Buy:
                <strong className="ml-2">
                  {position.maximumBuyRate}
                </strong>
              </p>

              <p>
                Target Sell:
                <strong className="ml-2">
                  {position.targetSellRate}
                </strong>
              </p>

              <p>
                Min Sell:
                <strong className="ml-2">
                  {position.minimumSellRate}
                </strong>
              </p>

              <p>
                Risk:
                <strong className="ml-2 text-yellow-400">
                  {position.riskLevel}
                </strong>
              </p>

<button
  type="button"
  disabled={position.requiredAction === "HOLD"}
  onClick={() => {
    const suggestedRate =
      position.requiredAction === "BUY"
        ? position.targetBuyRate
        : position.targetSellRate;

    const limitRate =
      position.requiredAction === "BUY"
        ? position.maximumBuyRate
        : position.minimumSellRate;

    const params = new URLSearchParams({
  currency: position.currency,
  baseCurrency: position.baseCurrency,
  direction: position.requiredAction,
  amount: String(position.requiredAmount),
  suggestedRate: String(suggestedRate),
  limitRate: String(limitRate),
  source: "position-board",
});

    router.push(`/fx/deals/new?${params.toString()}`);
}}
  className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-500"
>
  {position.requiredAction === "HOLD"
    ? "No Deal Required"
    : "Create Deal"}
</button>

            </div>
          </div>
        ))}
      </div>
    </main>
  );
}