"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";

import {
  getFxDealById,
  type FxDeal,
} from "../../lib/fx-deals";

import {
  createFxRateQuote,
  deleteFxRateQuote,
  getFxQuotesByDeal,
  selectFxRateQuote,
  type FxRateQuote,
} from "../../lib/fx-quotes";

type QuoteForm = {
  source_name: string;
  quoted_by: string;

  bid_rate: string;
  ask_rate: string;
  quoted_rate: string;

  valid_until: string;
  notes: string;
};

const emptyForm: QuoteForm = {
  source_name: "",
  quoted_by: "",

  bid_rate: "",
  ask_rate: "",
  quoted_rate: "",

  valid_until: "",
  notes: "",
};

export default function FxQuoteSheet() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const dealId = params.id;

  const [deal, setDeal] = useState<FxDeal | null>(null);
  const [quotes, setQuotes] = useState<FxRateQuote[]>([]);
  const [form, setForm] = useState<QuoteForm>(emptyForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectingId, setSelectingId] =
    useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadData = useCallback(async () => {
    if (!dealId) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const [dealData, quoteData] = await Promise.all([
        getFxDealById(dealId),
        getFxQuotesByDeal(dealId),
      ]);

      setDeal(dealData);
      setQuotes(quoteData);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load quote sheet."
      );
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const bestQuoteId = useMemo(() => {
    if (!deal || quotes.length === 0) {
      return null;
    }

    const activeQuotes = quotes.filter(
      (quote) =>
        quote.quote_status === "active" ||
        quote.quote_status === "selected"
    );

    if (activeQuotes.length === 0) {
      return null;
    }

    const sorted = [...activeQuotes].sort((first, second) => {
      if (deal.deal_type === "sell") {
        return (
          Number(second.quoted_rate) -
          Number(first.quoted_rate)
        );
      }

      return (
        Number(first.quoted_rate) -
        Number(second.quoted_rate)
      );
    });

    return sorted[0]?.id ?? null;
  }, [deal, quotes]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!deal) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await createFxRateQuote({
        fx_deal_id: deal.id,
        currency_pair:
          `${deal.base_currency}/${deal.quote_currency}`,

        source_name: form.source_name,
        quoted_by: form.quoted_by,

        bid_rate:
          form.bid_rate === ""
            ? null
            : Number(form.bid_rate),

        ask_rate:
          form.ask_rate === ""
            ? null
            : Number(form.ask_rate),

        quoted_rate: Number(form.quoted_rate),

        valid_until:
          form.valid_until || null,

        notes: form.notes,
      });

      setForm(emptyForm);
      setSuccessMessage("Rate quote added successfully.");

      await loadData();
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to add rate quote."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSelect(quoteId: string) {
    if (!deal) return;

    setSelectingId(quoteId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await selectFxRateQuote(deal.id, quoteId);

      setSuccessMessage(
        "The selected quote has been recorded."
      );

      await loadData();
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to select quote."
      );
    } finally {
      setSelectingId(null);
    }
  }

  async function handleDelete(quoteId: string) {
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await deleteFxRateQuote(quoteId);
      await loadData();
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete quote."
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#060a12] p-8 text-white">
        <div className="rounded-xl border border-white/10 bg-[#0d1422] p-12 text-center text-slate-400">
          Loading FX quote sheet...
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

  return (
    <main className="min-h-screen min-w-0 overflow-x-hidden bg-[#060a12] p-5 text-white md:p-8">
      <header className="mb-7">
        <button
          type="button"
          onClick={() =>
            router.push(`/fx/deals/${deal.id}`)
          }
          className="mb-4 text-sm text-slate-400 transition hover:text-white"
        >
          ← Back to Deal Workspace
        </button>

        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-400">
          VTC GROUP FX TRADING DESK
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          FX Quote Sheet
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          {deal.deal_no} · {deal.base_currency}/
          {deal.quote_currency} · {deal.deal_type.toUpperCase()}
        </p>
      </header>

      {errorMessage && (
        <Alert type="error">
          {errorMessage}
        </Alert>
      )}

      {successMessage && (
        <Alert type="success">
          {successMessage}
        </Alert>
      )}

      <section className="mb-6 rounded-xl border border-white/10 bg-[#0d1422] p-6">
        <h2 className="text-lg font-semibold">
          Add New Rate Quote
        </h2>

        <form
          onSubmit={handleSubmit}
          className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3"
        >
          <Field label="Source" required>
            <input
              required
              value={form.source_name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  source_name: event.target.value,
                }))
              }
              className={inputClass}
              placeholder="Bank, exchange or dealer"
            />
          </Field>

          <Field label="Quoted By">
            <input
              value={form.quoted_by}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  quoted_by: event.target.value,
                }))
              }
              className={inputClass}
              placeholder="Contact or dealer name"
            />
          </Field>

          <Field label="Bid Rate">
            <input
              type="number"
              step="0.00000001"
              value={form.bid_rate}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  bid_rate: event.target.value,
                }))
              }
              className={inputClass}
            />
          </Field>

          <Field label="Ask Rate">
            <input
              type="number"
              step="0.00000001"
              value={form.ask_rate}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  ask_rate: event.target.value,
                }))
              }
              className={inputClass}
            />
          </Field>

          <Field label="Quoted Rate" required>
            <input
              required
              type="number"
              min="0"
              step="0.00000001"
              value={form.quoted_rate}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  quoted_rate: event.target.value,
                }))
              }
              className={inputClass}
            />
          </Field>

          <Field label="Valid Until">
            <input
              type="datetime-local"
              value={form.valid_until}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  valid_until: event.target.value,
                }))
              }
              className={inputClass}
            />
          </Field>

          <div className="md:col-span-2 xl:col-span-3">
            <Field label="Notes">
              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                className={inputClass}
                placeholder="Quotation terms or internal comments"
              />
            </Field>
          </div>

          <div className="md:col-span-2 xl:col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold transition hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? "Adding Quote..." : "Add Rate Quote"}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0d1422]">
        <div className="overflow-x-auto">
          <table className="min-w-300 w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-[#101827] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-4">Source</th>
                <th className="px-5 py-4">Quoted By</th>
                <th className="px-5 py-4 text-right">Bid</th>
                <th className="px-5 py-4 text-right">Ask</th>
                <th className="px-5 py-4 text-right">
                  Quoted Rate
                </th>
                <th className="px-5 py-4">Quoted At</th>
                <th className="px-5 py-4">Valid Until</th>
                <th className="px-5 py-4">Evaluation</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {quotes.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-14 text-center text-slate-400"
                  >
                    No rate quotes have been recorded.
                  </td>
                </tr>
              ) : (
                quotes.map((quote) => (
                  <tr
                    key={quote.id}
                    className={
                      quote.is_selected
                        ? "bg-emerald-500/5"
                        : ""
                    }
                  >
                    <td className="px-5 py-4 font-semibold">
                      {quote.source_name}
                    </td>

                    <td className="px-5 py-4 text-slate-400">
                      {quote.quoted_by || "—"}
                    </td>

                    <td className="px-5 py-4 text-right">
                      {formatOptionalRate(quote.bid_rate)}
                    </td>

                    <td className="px-5 py-4 text-right">
                      {formatOptionalRate(quote.ask_rate)}
                    </td>

                    <td className="px-5 py-4 text-right font-semibold">
                      {formatRate(quote.quoted_rate)}
                    </td>

                    <td className="px-5 py-4 text-slate-400">
                      {formatDateTime(quote.quoted_at)}
                    </td>

                    <td className="px-5 py-4 text-slate-400">
                      {quote.valid_until
                        ? formatDateTime(quote.valid_until)
                        : "—"}
                    </td>

                    <td className="px-5 py-4">
                      {quote.id === bestQuoteId ? (
                        <span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-xs font-semibold text-blue-300">
                          Best Quote
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">
                          Alternative
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <QuoteStatus quote={quote} />
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={
                            quote.is_selected ||
                            selectingId !== null
                          }
                          onClick={() =>
                            void handleSelect(quote.id)
                          }
                          className="rounded-md border border-emerald-500/30 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {selectingId === quote.id
                            ? "Selecting..."
                            : quote.is_selected
                              ? "Selected"
                              : "Select"}
                        </button>

                        <button
                          type="button"
                          disabled={quote.is_selected}
                          onClick={() =>
                            void handleDelete(quote.id)
                          }
                          className="rounded-md border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-[#080d17] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500";

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-slate-300">
        {label}

        {required && (
          <span className="ml-1 text-red-400">*</span>
        )}
      </span>

      {children}
    </label>
  );
}

function QuoteStatus({
  quote,
}: {
  quote: FxRateQuote;
}) {
  if (quote.is_selected) {
    return (
      <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
        Selected
      </span>
    );
  }

  return (
    <span className="rounded-full bg-slate-500/15 px-2.5 py-1 text-xs font-semibold capitalize text-slate-300">
      {quote.quote_status}
    </span>
  );
}

function Alert({
  type,
  children,
}: {
  type: "error" | "success";
  children: React.ReactNode;
}) {
  const styles =
    type === "error"
      ? "border-red-500/30 bg-red-500/10 text-red-300"
      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";

  return (
    <div
      className={`mb-5 rounded-lg border px-4 py-3 text-sm ${styles}`}
    >
      {children}
    </div>
  );
}

function formatRate(value: number) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 8,
  });
}

function formatOptionalRate(value: number | null) {
  return value === null ? "—" : formatRate(value);
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
