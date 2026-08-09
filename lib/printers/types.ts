export type ReceiptPaperSizeValue = "MM58" | "MM80";

export type PrinterSettingsActionState = {
  status: "success" | "error";
  message: string;
};

export type PrinterSettingsActor = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "manager" | "cashier";
};
