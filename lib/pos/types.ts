export type PosMenuOption = {
  id: string;
  name: string;
  priceAdjustment: string;
  channelPriceAdjustments: Array<{ channelId: string; priceAdjustment: string }>;
};

export type PosMenuProduct = {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  sku: string | null;
  description: string | null;
  imageUrl: string | null;
  imagePositionX: number;
  imagePositionY: number;
  effectiveBasePrice: string;
  channelBasePrices: Array<{ channelId: string; basePrice: string }>;
  variantGroups: Array<{
    id: string;
    name: string;
    options: PosMenuOption[];
  }>;
  modifierGroups: Array<{
    id: string;
    name: string;
    minSelections: number;
    maxSelections: number;
    options: PosMenuOption[];
  }>;
};

export type PosMenu = {
  outlet: {
    id: string;
    code: string;
    name: string;
    timezone: string;
    taxRate: string;
    serviceChargeRate: string;
    pricesIncludeTax: boolean;
  };
  deliveryChannels: Array<{
    id: string;
    provider: "GOFOOD" | "GRABFOOD" | "SHOPEEFOOD";
    label: string;
    markupRate: string;
    estimatedFeeRate: string;
    settlementDelayHours: number;
  }>;
  categories: Array<{ id: string; name: string }>;
  products: PosMenuProduct[];
  truncated: boolean;
};

export type CheckoutActionState =
  | {
    status: "success";
    message: string;
    saleId: string;
    receiptNumber: string;
    total: string;
    changeAmount: string | null;
  }
  | {
    status: "error";
    message: string;
  };

export type PosActor = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "manager" | "cashier";
};

export type SaleListItem = {
  id: string;
  receiptNumber: string;
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  tableLabel: string | null;
  total: string;
  itemCount: number;
  paymentMethod: "CASH" | "QRIS" | "DEBIT_CARD" | "CREDIT_CARD" | "BANK_TRANSFER" | "DELIVERY_PLATFORM";
  deliveryProvider: "GOFOOD" | "GRABFOOD" | "SHOPEEFOOD" | null;
  externalOrderId: string | null;
  settlementStatus: "NOT_APPLICABLE" | "PENDING" | "SETTLED";
  expectedSettlementAt: string | null;
  createdByName: string;
  completedAt: string;
};

export type SalePage = {
  items: SaleListItem[];
  page: number;
  totalPages: number;
  totalItems: number;
};

export type SaleDetail = SaleListItem & {
  shiftId: string | null;
  outletName: string;
  outletCode: string;
  subtotal: string;
  serviceChargeRate: string;
  serviceChargeAmount: string;
  taxRate: string;
  taxAmount: string;
  pricesIncludeTax: boolean;
  paymentReference: string | null;
  tenderedAmount: string | null;
  changeAmount: string | null;
  expectedFeeAmount: string | null;
  expectedNetAmount: string | null;
  directEquivalentAmount: string | null;
  settlementReference: string | null;
  settledAt: string | null;
  items: Array<{
    id: string;
    productName: string;
    sku: string | null;
    quantity: number;
    note: string | null;
    unitPrice: string;
    lineTotal: string;
    variants: Array<{ groupName: string; optionName: string; priceAdjustment: string }>;
    modifiers: Array<{ groupName: string; optionName: string; priceAdjustment: string }>;
  }>;
};
