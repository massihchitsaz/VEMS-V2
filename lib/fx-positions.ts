export type FxPositionAction = "BUY" | "SELL" | "HOLD";

export type FxPositionRisk =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export interface FxPosition {
  id: string;
  currency: string;
  baseCurrency: string;
  cashBalance: number;
  expectedReceipts: number;
  openPurchases: number;
  expectedPayments: number;
  openSales: number;
  netPosition: number;
  targetPosition: number;
  requiredAmount: number;
  requiredAction: FxPositionAction;
  marketRate: number;
  targetBuyRate: number;
  maximumBuyRate: number;
  targetSellRate: number;
  minimumSellRate: number;
  averageCostRate: number;
  openDeals: number;
  settlementDueToday: number;
  riskLevel: FxPositionRisk;
  updatedAt: string;
}

export const fxPositions: FxPosition[] = [
  {
    id: "usd-aed",

    currency: "USD",
    baseCurrency: "AED",

    cashBalance: 1_250_000,
    expectedReceipts: 400_000,
    openPurchases: 150_000,

    expectedPayments: 1_900_000,
    openSales: 650_000,

    netPosition: -750_000,
    targetPosition: 0,
    requiredAmount: 750_000,

    requiredAction: "BUY",

    marketRate: 3.673,
    targetBuyRate: 3.6735,
    maximumBuyRate: 3.6745,

    targetSellRate: 3.676,
    minimumSellRate: 3.675,

    averageCostRate: 3.6728,

    openDeals: 8,
    settlementDueToday: 320_000,

    riskLevel: "HIGH",
    updatedAt: "2026-07-31T13:30:00+04:00",
  },

  {
    id: "eur-aed",

    currency: "EUR",
    baseCurrency: "AED",

    cashBalance: 820_000,
    expectedReceipts: 250_000,
    openPurchases: 100_000,

    expectedPayments: 400_000,
    openSales: 350_000,

    netPosition: 420_000,
    targetPosition: 100_000,
    requiredAmount: 320_000,

    requiredAction: "SELL",

    marketRate: 4.155,
    targetBuyRate: 4.148,
    maximumBuyRate: 4.152,

    targetSellRate: 4.162,
    minimumSellRate: 4.158,

    averageCostRate: 4.141,

    openDeals: 5,
    settlementDueToday: 180_000,

    riskLevel: "MEDIUM",
    updatedAt: "2026-07-31T13:30:00+04:00",
  },

  {
  id: "irr-aed",

  currency: "IRR",
  baseCurrency: "AED",

  cashBalance: 18_500_000_000,
  expectedReceipts: 6_000_000_000,
  openPurchases: 3_500_000_000,

  expectedPayments: 24_000_000_000,
  openSales: 8_000_000_000,

  netPosition: -4_000_000_000,
  targetPosition: 0,
  requiredAmount: 4_000_000_000,

  requiredAction: "BUY",

  marketRate: 0.0000191,
  targetBuyRate: 0.000019,
  maximumBuyRate: 0.0000192,

  targetSellRate: 0.0000195,
  minimumSellRate: 0.0000193,

  averageCostRate: 0.0000189,

  openDeals: 14,
  settlementDueToday: 2_700_000_000,

  riskLevel: "HIGH",
  updatedAt: "2026-08-01T09:15:00+04:00",
},

  {
    id: "cny-aed",

    currency: "CNY",
    baseCurrency: "AED",

    cashBalance: 2_800_000,
    expectedReceipts: 500_000,
    openPurchases: 200_000,

    expectedPayments: 4_100_000,
    openSales: 300_000,

    netPosition: -900_000,
    targetPosition: 0,
    requiredAmount: 900_000,

    requiredAction: "BUY",

    marketRate: 0.507,
    targetBuyRate: 0.5065,
    maximumBuyRate: 0.508,

    targetSellRate: 0.511,
    minimumSellRate: 0.5095,

    averageCostRate: 0.5058,

    openDeals: 11,
    settlementDueToday: 1_100_000,

    riskLevel: "CRITICAL",
    updatedAt: "2026-07-31T13:30:00+04:00",
  },
];

export function calculateNetPosition(position: FxPosition): number {
  return (
    position.cashBalance +
    position.expectedReceipts +
    position.openPurchases -
    position.expectedPayments -
    position.openSales
  );
}

export function getPositionLabel(position: FxPosition): string {
  if (position.netPosition > 0) {
    return `Long ${position.currency}`;
  }

  if (position.netPosition < 0) {
    return `Short ${position.currency}`;
  }

  return "Balanced";
}

export function formatPositionAmount(
  amount: number,
  currency: string,
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
}