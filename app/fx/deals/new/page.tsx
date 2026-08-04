"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  createFxDeal,
  type CreateFxDealInput,
  type FxDealStatus,
  type FxDealType,
} from "@/lib/fx-deals";

const today = new Date().toISOString().slice(0, 10);

const currencies = [
  "AED",
  "USD",
  "IRR",
  "EUR",
  "CNY",
  "CAD",
  "AUD",
  "GBP",
];

const initialForm: CreateFxDealInput = {
  deal_type: "buy",

  base_currency: "USD",
  quote_currency: "AED",

  base_amount: 0,
  agreed_rate: 0,
  market_rate: null,

  counterparty_name: "",
  counterparty_type: "exchange",

  trade_date: today,
  value_date: today,
  settlement_date: today,

  payment_account: "",
  receiving_account: "",

  status: "draft",
  notes: "",
};

function parseNumericValue(value: string): number {
  const parsedValue = Number(value.replace(/,/g, ""));

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatRate(
  value: number | null,
  baseCurrency?: string,
): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  if (baseCurrency === "IRR" && value > 0) {
    return `1 AED = ${Math.round(1 / value).toLocaleString("en-US")} IRR`;
  }

  return value.toLocaleString("en-US", {
    maximumFractionDigits: 8,
  });
}

export default function NewFxDealPage() {
  const router = useRouter();

  const [form, setForm] =
    useState<CreateFxDealInput>(initialForm);

  const [treasuryLimitRate, setTreasuryLimitRate] =
    useState<number | null>(null);

  const [treasurySource, setTreasurySource] =
    useState<string | null>(null);

  const [approvalReason, setApprovalReason] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const currency = params.get("currency");
    const baseCurrency = params.get("baseCurrency");
    const direction = params.get("direction");
    const amount = params.get("amount");
    const suggestedRate = params.get("suggestedRate");
    const limitRate = params.get("limitRate");
    const source = params.get("source");

    const parsedAmount =
      amount && Number.isFinite(Number(amount))
        ? Number(amount)
        : null;

    const parsedSuggestedRate =
      suggestedRate && Number.isFinite(Number(suggestedRate))
        ? Number(suggestedRate)
        : null;

    const parsedLimitRate =
      limitRate && Number.isFinite(Number(limitRate))
        ? Number(limitRate)
        : null;

    if (parsedLimitRate !== null) {
      setTreasuryLimitRate(parsedLimitRate);
    }

    setTreasurySource(source);

    if (
      !currency &&
      !baseCurrency &&
      !direction &&
      parsedAmount === null &&
      parsedSuggestedRate === null
    ) {
      return;
    }

    setForm((currentForm) => ({
      ...currentForm,

      deal_type:
        direction === "SELL"
          ? "sell"
          : direction === "BUY"
            ? "buy"
            : currentForm.deal_type,

      base_currency:
        currency ?? currentForm.base_currency,

      quote_currency:
        baseCurrency ?? currentForm.quote_currency,

      base_amount:
        parsedAmount ?? currentForm.base_amount,

      agreed_rate:
        parsedSuggestedRate ?? currentForm.agreed_rate,

      market_rate:
        parsedSuggestedRate ?? currentForm.market_rate,

      notes: [
        currentForm.notes,
        source === "position-board"
          ? "Deal initiated from Treasury Position Board."
          : "",
        parsedLimitRate !== null
          ? `Internal treasury rate limit: ${parsedLimitRate}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    }));
  }, []);

  const enteredRate =
    typeof form.agreed_rate === "number"
      ? form.agreed_rate
      : Number(form.agreed_rate);

  const hasEnteredRate =
    Number.isFinite(enteredRate) && enteredRate > 0;

  const exceedsTreasuryLimit =
    treasuryLimitRate !== null &&
    hasEnteredRate &&
    (form.deal_type === "buy"
      ? enteredRate > treasuryLimitRate
      : enteredRate < treasuryLimitRate);

  const rateValidationStatus:
    | "waiting"
    | "within-limit"
    | "approval-required" =
    !hasEnteredRate
      ? "waiting"
      : exceedsTreasuryLimit
        ? "approval-required"
        : "within-limit";

  const quoteAmount = useMemo(() => {
    const amount = Number(form.base_amount);
    const rate = Number(form.agreed_rate);

    if (
      !Number.isFinite(amount) ||
      !Number.isFinite(rate) ||
      amount <= 0 ||
      rate <= 0
    ) {
      return 0;
    }

    return amount * rate;
  }, [form.base_amount, form.agreed_rate]);

  const rateDifference = useMemo(() => {
    if (
      form.market_rate === null ||
      !Number.isFinite(Number(form.market_rate)) ||
      !hasEnteredRate
    ) {
      return null;
    }

    return enteredRate - Number(form.market_rate);
  }, [enteredRate, form.market_rate, hasEnteredRate]);

  const estimatedRateResult = useMemo(() => {
    if (rateDifference === null || form.base_amount <= 0) {
      return null;
    }

    const rawResult =
      rateDifference * Number(form.base_amount);

    return form.deal_type === "buy"
      ? rawResult * -1
      : rawResult;
  }, [
    form.base_amount,
    form.deal_type,
    rateDifference,
  ]);

  function updateForm<K extends keyof CreateFxDealInput>(
    field: K,
    value: CreateFxDealInput[K],
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));

    setErrorMessage("");
    setSuccessMessage("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!form.counterparty_name.trim()) {
      setErrorMessage("Counterparty name is required.");
      return;
    }

    if (!Number.isFinite(form.base_amount) || form.base_amount <= 0) {
      setErrorMessage("Base amount must be greater than zero.");
      return;
    }

    if (
      !Number.isFinite(Number(form.agreed_rate)) ||
      Number(form.agreed_rate) <= 0
    ) {
      setErrorMessage("Agreed rate must be greater than zero.");
      return;
    }

    if (
      exceedsTreasuryLimit &&
      approvalReason.trim().length < 10
    ) {
      setErrorMessage(
        "A commercial reason of at least 10 characters is required for a rate outside the Treasury limit.",
      );
      return;
    }

    const approvalNotes = exceedsTreasuryLimit
      ? [
          "TREASURY APPROVAL REQUIRED",
          `Approval reason: ${approvalReason.trim()}`,
          treasuryLimitRate !== null
            ? `Treasury limit: ${treasuryLimitRate}`
            : "",
          `Dealer rate: ${enteredRate}`,
        ]
          .filter(Boolean)
          .join("\n")
      : "";

    const formToSubmit: CreateFxDealInput = {
      ...form,
      counterparty_name: form.counterparty_name.trim(),

      notes: [
       (form.notes ?? "").trim(),
        approvalNotes,
      ]
        .filter(Boolean)
        .join("\n\n"),
    };

    setIsSaving(true);

    try {
      const createdDeal = await createFxDeal(formToSubmit);

      setSuccessMessage(
        `FX deal ${createdDeal.deal_no} created successfully.`,
      );

      window.setTimeout(() => {
        router.push("/fx/deals");
        router.refresh();
      }, 1200);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create FX deal.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const statusText =
    rateValidationStatus === "within-limit"
      ? "Within Treasury Limit"
      : rateValidationStatus === "approval-required"
        ? "Approval Required"
        : "Waiting for Rate";

  const statusClassName =
    rateValidationStatus === "within-limit"
      ? "text-emerald-400"
      : rateValidationStatus === "approval-required"
        ? "text-red-400"
        : "text-amber-300";

  return (
    <main className="min-h-screen bg-[#060a12] p-5 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-400">
              VTC Group FX Trading Desk
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              New FX Deal Ticket
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Register, price and control a foreign-exchange transaction.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/fx/deals")}
            className="rounded-lg border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
          >
            Back to Deals
          </button>
        </header>

        <section className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-300">
                Treasury Recommendation
              </p>

              <h2 className="mt-2 text-3xl font-bold">
                {form.deal_type.toUpperCase()}{" "}
                {form.base_currency}
              </h2>

              <p className="mt-2 text-sm text-slate-300">
                {treasurySource === "position-board"
                  ? "Generated from the Treasury Position Board."
                  : "Manual FX deal ticket."}
              </p>
            </div>

            <div className="rounded-xl bg-blue-600 px-6 py-3 text-center">
              <p className="text-xs uppercase tracking-wider text-blue-100">
                Suggested Rate
              </p>

              <p className="mt-1 text-xl font-bold">
                {formatRate(
                  Number(form.agreed_rate),
                  form.base_currency,
                )}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-sm text-slate-400">
                Required Amount
              </p>

              <p className="mt-2 text-xl font-bold">
                {formatAmount(form.base_amount)}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {form.base_currency}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-sm text-slate-400">
                Market Rate
              </p>

              <p className="mt-2 text-xl font-bold">
                {formatRate(
                  form.market_rate ?? null,
                  form.base_currency,
                )}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-sm text-slate-400">
                Dealer Rate
              </p>

              <p className="mt-2 text-xl font-bold text-emerald-400">
                {formatRate(
                  Number(form.agreed_rate),
                  form.base_currency,
                )}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-sm text-slate-400">
                Treasury Limit
              </p>

              <p className="mt-2 text-xl font-bold text-blue-300">
                {formatRate(
                  treasuryLimitRate,
                  form.base_currency,
                )}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-sm text-slate-400">
                Rate Status
              </p>

              <p className={`mt-2 text-lg font-bold ${statusClassName}`}>
                {statusText}
              </p>
            </div>
          </div>

          {exceedsTreasuryLimit && (
            <div className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 p-5">
              <p className="font-semibold text-red-300">
                The entered rate exceeds the approved Treasury limit.
              </p>

              <p className="mt-1 text-sm text-red-200/80">
                This deal requires Treasury Manager approval before confirmation.
              </p>

              <label
                htmlFor="approvalReason"
                className="mt-4 block text-sm font-medium text-red-200"
              >
                Commercial reason for approval
              </label>

              <textarea
                id="approvalReason"
                value={approvalReason}
                onChange={(event) =>
                  setApprovalReason(event.target.value)
                }
                placeholder="Explain why this transaction should be approved outside the Treasury limit..."
                className="mt-2 min-h-28 w-full rounded-xl border border-red-500/30 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-red-400"
              />

              <p className="mt-2 text-xs text-red-200/60">
                Minimum 10 characters required.
              </p>
            </div>
          )}
        </section>

        <form
          onSubmit={handleSubmit}
          className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]"
        >
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-[#0d1423] p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold">
                  Deal Details
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Define the transaction direction, currency pair, amount and rates.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">
                    Deal Type
                  </span>

                  <select
                    value={form.deal_type}
                    onChange={(event) =>
                      updateForm(
                        "deal_type",
                        event.target.value as FxDealType,
                      )
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-blue-500"
                  >
                    <option value="buy">BUY</option>
                    <option value="sell">SELL</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">
                    Status
                  </span>

                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateForm(
                        "status",
                        event.target.value as FxDealStatus,
                      )
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-blue-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="pending">Pending</option>
                    <option value="settled">Settled</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">
                    Base Currency
                  </span>

                  <select
                    value={form.base_currency}
                    onChange={(event) =>
                      updateForm(
                        "base_currency",
                        event.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-blue-500"
                  >
                    {currencies.map((currency) => (
                      <option
                        key={currency}
                        value={currency}
                      >
                        {currency}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">
                    Quote Currency
                  </span>

                  <select
                    value={form.quote_currency}
                    onChange={(event) =>
                      updateForm(
                        "quote_currency",
                        event.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-blue-500"
                  >
                    {currencies.map((currency) => (
                      <option
                        key={currency}
                        value={currency}
                      >
                        {currency}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">
                    Base Amount
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.base_amount || ""}
                    onChange={(event) =>
                      updateForm(
                        "base_amount",
                        parseNumericValue(event.target.value),
                      )
                    }
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-blue-500"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">
                    Market Rate
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.market_rate ?? ""}
                    onChange={(event) =>
                      updateForm(
                        "market_rate",
                        event.target.value
                          ? parseNumericValue(event.target.value)
                          : null,
                      )
                    }
                    placeholder="0.0000"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-blue-500"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm text-slate-300">
                    Agreed Dealer Rate
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.agreed_rate || ""}
                    onChange={(event) =>
                      updateForm(
                        "agreed_rate",
                        parseNumericValue(event.target.value),
                      )
                    }
                    placeholder="0.0000"
                    className={`w-full rounded-xl border bg-slate-950 px-4 py-3 text-lg font-semibold outline-none transition ${
                      exceedsTreasuryLimit
                        ? "border-red-500 focus:border-red-400"
                        : "border-slate-700 focus:border-blue-500"
                    }`}
                  />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-[#0d1423] p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold">
                  Counterparty
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Identify the customer, exchange, bank or supplier involved.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">
                    Counterparty Name
                  </span>

                  <input
                    type="text"
                    value={form.counterparty_name}
                    onChange={(event) =>
                      updateForm(
                        "counterparty_name",
                        event.target.value,
                      )
                    }
                    placeholder="Enter counterparty name"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-blue-500"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">
                    Counterparty Type
                  </span>

                  <select
                    value={form.counterparty_type ?? "exchange"}
                    onChange={(event) =>
                      updateForm(
                        "counterparty_type",
                        event.target.value as CreateFxDealInput["counterparty_type"],
                      )
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-blue-500"
                  >
                    <option value="exchange">Exchange</option>
                    <option value="customer">Customer</option>
                    <option value="supplier">Supplier</option>
                    <option value="bank">Bank</option>
                    <option value="broker">Broker</option>
                    <option value="other">Other</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-[#0d1423] p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold">
                  Dates and Settlement
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Record trade, value and settlement instructions.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">
                    Trade Date
                  </span>

                  <input
                    type="date"
                    value={form.trade_date}
                    onChange={(event) =>
                      updateForm(
                        "trade_date",
                        event.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-blue-500"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">
                    Value Date
                  </span>

                  <input
                    type="date"
                   value={form.payment_account ?? ""}
                    onChange={(event) =>
                      updateForm(
                        "value_date",
                        event.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-blue-500"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">
                    Settlement Date
                  </span>

                  <input
                    type="date"
                    value={form.receiving_account ?? ""}
                    onChange={(event) =>
                      updateForm(
                        "settlement_date",
                        event.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-blue-500"
                  />
                </label>

                <label className="block md:col-span-3">
                  <span className="mb-2 block text-sm text-slate-300">
                    Payment Account
                  </span>

                  <input
                    type="text"
                    value={form.payment_account}
                    onChange={(event) =>
                      updateForm(
                        "payment_account",
                        event.target.value,
                      )
                    }
                    placeholder="Account used to make payment"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-blue-500"
                  />
                </label>

                <label className="block md:col-span-3">
                  <span className="mb-2 block text-sm text-slate-300">
                    Receiving Account
                  </span>

                  <input
                    type="text"
                    value={form.receiving_account}
                    onChange={(event) =>
                      updateForm(
                        "receiving_account",
                        event.target.value,
                      )
                    }
                    placeholder="Account used to receive funds"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-blue-500"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-[#0d1423] p-6">
              <h2 className="text-xl font-semibold">
                Dealer Notes
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Record commercial background, negotiation details and settlement instructions.
              </p>

              <textarea
                value={form.notes}
                onChange={(event) =>
                  updateForm("notes", event.target.value)
                }
                placeholder="Add notes related to this transaction..."
                className="mt-5 min-h-40 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-blue-500"
              />
            </section>
          </div>

          <aside className="space-y-6">
            <section className="sticky top-6 rounded-2xl border border-slate-800 bg-[#0d1423] p-6">
              <h2 className="text-xl font-semibold">
                Deal Summary
              </h2>

              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-sm text-slate-400">
                    Direction
                  </span>

                  <span className="font-semibold">
                    {form.deal_type.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-sm text-slate-400">
                    Currency Pair
                  </span>

                  <span className="font-semibold">
                    {form.base_currency}/{form.quote_currency}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-sm text-slate-400">
                    Base Amount
                  </span>

                  <span className="font-semibold">
                    {formatAmount(form.base_amount)}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-sm text-slate-400">
                    Agreed Rate
                  </span>

                  <span className="font-semibold">
                    {formatRate(
                      Number(form.agreed_rate),
                      form.base_currency,
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-sm text-slate-400">
                    Quote Amount
                  </span>

                  <span className="font-semibold text-blue-300">
                    {formatAmount(quoteAmount)}{" "}
                    {form.quote_currency}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-sm text-slate-400">
                    Estimated Rate Result
                  </span>

                  <span
                    className={`font-semibold ${
                      estimatedRateResult === null
                        ? "text-slate-300"
                        : estimatedRateResult >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                    }`}
                  >
                    {estimatedRateResult === null
                      ? "-"
                      : `${formatAmount(
                          estimatedRateResult,
                        )} ${form.quote_currency}`}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">
                    Treasury Status
                  </span>

                  <span className={`font-semibold ${statusClassName}`}>
                    {statusText}
                  </span>
                </div>
              </div>

              {errorMessage && (
                <div className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className="mt-6 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-300">
                  {successMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className={`mt-6 w-full rounded-xl px-5 py-4 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  exceedsTreasuryLimit
                    ? "bg-amber-600 hover:bg-amber-500"
                    : "bg-blue-600 hover:bg-blue-500"
                }`}
              >
                {isSaving
                  ? "Saving Deal..."
                  : exceedsTreasuryLimit
                    ? "Submit for Treasury Approval"
                    : "Create FX Deal"}
              </button>

              <p className="mt-3 text-center text-xs text-slate-500">
                {exceedsTreasuryLimit
                  ? "This deal will be recorded with an approval requirement."
                  : "The transaction is currently within the approved Treasury rate."}
              </p>
            </section>
          </aside>
        </form>
      </div>
    </main>
  );
}