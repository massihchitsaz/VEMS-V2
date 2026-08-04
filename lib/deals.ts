import { createClient } from "@/lib/supabase/client";

export type DealInput = {
  customer_id: string | null;
  supplier_id: string | null;

  commodity: string;
  origin_country: string;
  destination_country: string;
  incoterm: string;

  quantity: number;
  unit: string;

  buy_currency: string;
  sell_currency: string;

  buy_price: number;
  sell_price: number;

  payment_status: string;
  shipment_status: string;

  etd: string | null;
  eta: string | null;

  container_no: string;
  bl_no: string;
  notes: string;
};

export type Deal = DealInput & {
  id: string;
  deal_no: string;
  dealer_id: string;

  amount: number;
  profit: number;

  created_at?: string;
};

function generateDealNumber() {
  const now = new Date();

  const datePart = now
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");

  const randomPart = Math.floor(
    1000 + Math.random() * 9000
  );

  return `VTC-${datePart}-${randomPart}`;
}

export async function createDeal(
  values: DealInput
): Promise<Deal> {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Authenticated user was not found.");
  }

  const quantity = Number(values.quantity) || 0;
  const buyPrice = Number(values.buy_price) || 0;
  const sellPrice = Number(values.sell_price) || 0;

  const totalAmount = quantity * sellPrice;
  const totalProfit =
    quantity * (sellPrice - buyPrice);

  const payload = {
    deal_no: generateDealNumber(),

    customer_id: values.customer_id || null,
    supplier_id: values.supplier_id || null,
    dealer_id: user.id,

    commodity: values.commodity.trim(),
    origin_country: values.origin_country.trim(),
    destination_country:
      values.destination_country.trim(),
    incoterm: values.incoterm.trim(),

    quantity,
    unit: values.unit.trim(),

    buy_currency: values.buy_currency,
    sell_currency: values.sell_currency,

    buy_price: buyPrice,
    sell_price: sellPrice,

    amount: totalAmount,
    profit: totalProfit,

    payment_status: values.payment_status,
    shipment_status: values.shipment_status,

    etd: values.etd || null,
    eta: values.eta || null,

    container_no:
      values.container_no.trim() || null,
    bl_no: values.bl_no.trim() || null,
    notes: values.notes.trim() || null,
  };

  const { data, error } = await supabase
    .from("deals")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as Deal;
}

export async function getDeals(): Promise<Deal[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return (data ?? []) as Deal[];
}
