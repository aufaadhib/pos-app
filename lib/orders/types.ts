export type OrderActor = { id: string; name: string; email: string; role: "owner" | "manager" | "cashier" };

export type OrderActionState = {
  status: "success" | "error" | "conflict";
  message: string;
  orderId?: string;
  version?: number;
  itemIds?: string[];
};

export type OpenOrder = {
  id: string;
  version: number;
  lastSentVersion: number;
  orderType: "DINE_IN" | "TAKEAWAY";
  tableLabel: string | null;
  total: string;
  createdByName: string;
  updatedAt: string;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    sku: string | null;
    quantity: number;
    note: string;
    variantOptionIds: string[];
    modifierOptionIds: string[];
    selectionLabel: string;
    unitPrice: string;
  }>;
};

export type KitchenTicketView = {
  id: string;
  number: string;
  kind: "INITIAL" | "DELTA";
  status: "NEW" | "PROCESSING" | "COMPLETED";
  sentAt: string;
  sentByName: string;
  order: { orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY"; tableLabel: string | null; externalOrderId: string | null };
  lines: Array<{ id: string; action: "ADD" | "UPDATE" | "REMOVE"; productName: string; quantity: number; selectionLabel: string | null; note: string | null; reason: string | null }>;
};
