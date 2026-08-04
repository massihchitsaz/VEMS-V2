import { createClient } from "./supabase/client";

export type FxQuoteStatus =
  | "active"
  | "expired"
  | "selected"
  | "rejected";

export type FxRateQuote = {
  id: string;
  fx_deal_id: string;
  currency_pair: string;

  bid_rate: number | null;
  ask_rate: number | null;
  quoted_rate: number;

  source_name: string;
  quoted_by: string | null;

  quoted_at: string;
  valid_until: string | null;

  markup: number | null;
  notes: string | null;

  is_selected: boolean;
  quote_status: FxQuoteStatus;
};

export type CreateFxRateQuoteInput = {
  fx_deal_id: string;
  currency_pair: string;

  bid_rate?: number | null;
  ask_rate?: number | null;
  quoted_rate: number;

  source_name: string;
  quoted_by?: string;
  valid_until?: string | null;

  markup?: number | null;
  notes?: string;
};

export async function getFxQuotesByDeal(
  dealId: string
): Promise<FxRateQuote[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("fx_rate_quotes")
    .select("*")
    .eq("fx_deal_id", dealId)
    .order("quoted_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return (data ?? []) as FxRateQuote[];
}

export async function createFxRateQuote(
  values: CreateFxRateQuoteInput
): Promise<FxRateQuote> {
  const supabase = createClient();

  const quotedRate = Number(values.quoted_rate);

  if (!values.source_name.trim()) {
    throw new Error("Quote source is required.");
  }

  if (quotedRate <= 0) {
    throw new Error(
      "Quoted rate must be greater than zero."
    );
  }

  const payload = {
    fx_deal_id: values.fx_deal_id,

    currency_pair:
      values.currency_pair.trim().toUpperCase(),

    bid_rate:
      values.bid_rate === null ||
      values.bid_rate === undefined
        ? null
        : Number(values.bid_rate),

    ask_rate:
      values.ask_rate === null ||
      values.ask_rate === undefined
        ? null
        : Number(values.ask_rate),

    quoted_rate: quotedRate,

    source_name: values.source_name.trim(),

    quoted_by:
      values.quoted_by?.trim() || null,

    valid_until:
      values.valid_until || null,

    markup:
      values.markup === null ||
      values.markup === undefined
        ? null
        : Number(values.markup),

    notes:
      values.notes?.trim() || null,

    is_selected: false,
    quote_status: "active",
  };

  const { data, error } = await supabase
    .from("fx_rate_quotes")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as FxRateQuote;
}

export async function selectFxRateQuote(
  dealId: string,
  quoteId: string
): Promise<void> {
  const supabase = createClient();

  const { error: resetError } = await supabase
    .from("fx_rate_quotes")
    .update({
      is_selected: false,
      quote_status: "rejected",
    })
    .eq("fx_deal_id", dealId);

  if (resetError) {
    throw resetError;
  }

  const { error: selectError } = await supabase
    .from("fx_rate_quotes")
    .update({
      is_selected: true,
      quote_status: "selected",
    })
    .eq("id", quoteId)
    .eq("fx_deal_id", dealId);

  if (selectError) {
    throw selectError;
  }
}

export async function deleteFxRateQuote(
  quoteId: string
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("fx_rate_quotes")
    .delete()
    .eq("id", quoteId);

  if (error) {
    throw error;
  }
}
