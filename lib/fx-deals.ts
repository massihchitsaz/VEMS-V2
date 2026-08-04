import { createClient } from "@/lib/supabase/client";

export type FxDealType = "buy" | "sell" | "swap";

export type FxDealStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "partially_settled"
  | "settled"
  | "cancelled";

export type FxDeal = {
  id: string;
  deal_no: string;

  deal_type: FxDealType;

  base_currency: string;
  quote_currency: string;

  base_amount: number;
  agreed_rate: number;
  quote_amount: number;

  market_rate: number | null;
  spread: number | null;
  expected_profit: number | null;

  counterparty_name: string;
  counterparty_type: string | null;

  trade_date: string;
  value_date: string | null;
  settlement_date: string | null;

  payment_account: string | null;
  receiving_account: string | null;

  status: FxDealStatus;

  dealer_id: string;
  approved_by: string | null;

  notes: string | null;

  created_at: string;
  updated_at: string;
};

export type CreateFxDealInput = {
  deal_type: FxDealType;

  base_currency: string;
  quote_currency: string;

  base_amount: number;
  agreed_rate: number;
  market_rate?: number | null;

  counterparty_name: string;
  counterparty_type?: string | null;

  trade_date: string;
  value_date?: string | null;
  settlement_date?: string | null;

  payment_account?: string;
  receiving_account?: string;

  status?: FxDealStatus;
  notes?: string;
};

function generateFxDealNumber(): string {
  const now = new Date();

  const datePart = now
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");

  const timePart = now
    .toTimeString()
    .slice(0, 8)
    .replaceAll(":", "");

  const randomPart = Math.floor(
    100 + Math.random() * 900
  );

  return `FX-${datePart}-${timePart}-${randomPart}`;
}

export async function createFxDeal(
  values: CreateFxDealInput
): Promise<FxDeal> {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error(
      "Authenticated user was not found."
    );
  }

  const baseAmount = Number(values.base_amount);
  const agreedRate = Number(values.agreed_rate);
  const marketRate = values.market_rate
    ? Number(values.market_rate)
    : null;

  if (baseAmount <= 0) {
    throw new Error(
      "Base amount must be greater than zero."
    );
  }

  if (agreedRate <= 0) {
    throw new Error(
      "Agreed rate must be greater than zero."
    );
  }

  const quoteAmount = baseAmount * agreedRate;

  const spread =
  marketRate !== null
    ? agreedRate - marketRate
    : null;

const expectedProfit =
  marketRate !== null
    ? values.deal_type === "buy"
      ? baseAmount * (marketRate - agreedRate)
      : values.deal_type === "sell"
        ? baseAmount * (agreedRate - marketRate)
        : 0
    : null;

  const payload = {
    deal_no: generateFxDealNumber(),

    deal_type: values.deal_type,

    base_currency:
      values.base_currency.trim().toUpperCase(),

    quote_currency:
      values.quote_currency.trim().toUpperCase(),

    base_amount: baseAmount,
    agreed_rate: agreedRate,
    quote_amount: quoteAmount,

    market_rate: marketRate,
    spread,
    expected_profit: expectedProfit,

    counterparty_name:
      values.counterparty_name.trim(),

    counterparty_type:
      values.counterparty_type || null,

    trade_date: values.trade_date,

    value_date: values.value_date || null,

    settlement_date:
      values.settlement_date || null,

    payment_account:
      values.payment_account?.trim() || null,

    receiving_account:
      values.receiving_account?.trim() || null,

    status: values.status || "draft",

    dealer_id: user.id,

    notes: values.notes?.trim() || null,
  };

  const { data, error } = await supabase
    .from("fx_deals")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as FxDeal;
}

export async function getFxDeals(): Promise<FxDeal[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("fx_deals")
    .select("*")
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return (data ?? []) as FxDeal[];
}

export async function getFxDealById(
  id: string
): Promise<FxDeal> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("fx_deals")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data as FxDeal;
}

export async function updateFxDealStatus(
  id: string,
  status: FxDealStatus
): Promise<FxDeal> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("fx_deals")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as FxDeal;
}
