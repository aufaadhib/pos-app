import type { DeliveryProvider, PaymentSettlementStatus, SettlementBatchStatus } from "@/generated/prisma/client";

export const deliveryProviderLabels: Record<DeliveryProvider, string> = {
  GOFOOD: "GoFood",
  GRABFOOD: "GrabFood",
  SHOPEEFOOD: "ShopeeFood",
};

export type DeliveryChannelDto = {
  id: string;
  provider: DeliveryProvider;
  label: string;
  isActive: boolean;
  markupRate: string;
  estimatedFeeRate: string;
  roundingUnit: number;
  settlementDelayHours: number;
  updatedAt: string;
};

export type PendingSettlementDto = {
  paymentId: string;
  saleId: string;
  receiptNumber: string;
  externalOrderId: string;
  channelId: string;
  provider: DeliveryProvider;
  grossAmount: string;
  directEquivalentAmount: string;
  expectedFeeAmount: string;
  expectedNetAmount: string;
  expectedSettlementAt: string;
  completedAt: string;
  overdue: boolean;
};

export type SettlementBatchDto = {
  id: string;
  provider: DeliveryProvider;
  reference: string;
  grossAmount: string;
  platformFeeAmount: string;
  merchantPromotionAmount: string;
  otherAdjustmentAmount: string;
  netReceivedAmount: string;
  receivedAt: string;
  status: SettlementBatchStatus;
  transactionCount: number;
};

export type SettlementSummaryDto = {
  pendingGross: string;
  expectedNet: string;
  overdueGross: string;
  settledNet: string;
  settledFees: string;
  directComparison: string;
  pendingCount: number;
  statuses: PaymentSettlementStatus[];
};

export type DeliveryProductPriceDto = {
  id: string;
  name: string;
  sku: string | null;
  directPrice: string;
  overrides: Array<{ channelId: string; priceOverride: string }>;
};

export type DeliveryManagementDto = {
  channels: DeliveryChannelDto[];
  products: DeliveryProductPriceDto[];
  pending: PendingSettlementDto[];
  batches: SettlementBatchDto[];
  summary: SettlementSummaryDto;
};

export type DeliveryActionState = {
  status: "idle" | "success" | "error" | "conflict";
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialDeliveryActionState: DeliveryActionState = { status: "idle", message: "" };
