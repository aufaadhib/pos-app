import type { AppRole } from "@/lib/auth/permissions";

export type ShiftActor = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
};

export type ShiftActionState = {
  status: "idle" | "success" | "error" | "conflict";
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
  shiftId?: string;
  expectedCash?: string;
  actualCash?: string;
  cashDifference?: string;
};

export const initialShiftActionState: ShiftActionState = { status: "idle", message: "" };

export type PaymentSummary = {
  method: "CASH" | "QRIS" | "DEBIT_CARD" | "CREDIT_CARD" | "BANK_TRANSFER" | "DELIVERY_PLATFORM";
  amount: string;
  count: number;
};

export type CashShiftListItem = {
  id: string;
  outletId: string;
  businessDate: string;
  status: "OPEN" | "CLOSED";
  openingCash: string;
  openedByName: string;
  openedAt: string;
  closeMode: "SELF" | "FORCED" | null;
  closedByName: string | null;
  closedAt: string | null;
  expectedCash: string | null;
  actualCash: string | null;
  cashDifference: string | null;
  originalActualCash: string | null;
  originalCashDifference: string | null;
  reconciliationCorrection: CashShiftReconciliationCorrection | null;
};

export type CashShiftReconciliationCorrection = {
  id: string;
  revision: number;
  previousActualCash: string;
  correctedActualCash: string;
  previousDifference: string;
  correctedDifference: string;
  reason: string;
  actorName: string;
  actorEmail: string;
  createdAt: string;
};

export type CurrentCashShift = CashShiftListItem & {
  outletName: string;
  outletTimezone: string;
  isCurrentUser: boolean;
};

export type CashShiftPage = {
  current: CurrentCashShift | null;
  openShifts: CashShiftListItem[];
  history: CashShiftListItem[];
  page: number;
  totalPages: number;
  totalItems: number;
};

export type CashShiftDetail = CashShiftListItem & {
  isCurrentUser: boolean;
  outletName: string;
  outletTimezone: string;
  openedByEmail: string;
  closedByEmail: string | null;
  closeReason: string | null;
  cashSales: string | null;
  cashRefunds: string | null;
  cashIn: string | null;
  cashOut: string | null;
  paymentSummaries: PaymentSummary[] | null;
  movements: Array<{
    id: string;
    direction: "IN" | "OUT";
    category: "ADDITIONAL_FLOAT" | "CASH_DROP" | "OPERATING_EXPENSE" | "OTHER";
    amount: string;
    reason: string;
    actorName: string;
    createdAt: string;
  }>;
  audits: Array<{
    id: string;
    action: "OPEN" | "CASH_IN" | "CASH_OUT" | "CLOSE" | "FORCE_CLOSE" | "RECONCILIATION_CORRECT";
    actorEmail: string;
    createdAt: string;
  }>;
  sales: Array<{
    id: string;
    receiptNumber: string;
    total: string;
    paymentMethod: PaymentSummary["method"];
    completedAt: string;
  }>;
  salesPage: number;
  salesTotalPages: number;
  salesTotalItems: number;
};
