export type AdminActor = {
  id: string;
  email: string;
  role: "owner" | "manager" | "cashier";
};

export type OutletItem = {
  id: string;
  code: string;
  name: string;
  timezone: string;
  addressLine: string | null;
  provinceCode: string;
  provinceName: string;
  cityCode: string;
  cityName: string;
  taxRate: string;
  serviceChargeRate: string;
  pricesIncludeTax: boolean;
  status: "ACTIVE" | "ARCHIVED";
  staffCount: number;
  updatedAt: string;
};

export type OutletPage = {
  items: OutletItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type OutletActionState = {
  status: "idle" | "success" | "error" | "conflict";
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialOutletActionState: OutletActionState = {
  status: "idle",
  message: "",
};
