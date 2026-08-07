export type StaffOutletOption = {
  id: string;
  code: string;
  name: string;
};

export type StaffItem = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "manager" | "cashier";
  banned: boolean;
  mustChangePassword: boolean;
  outlets: StaffOutletOption[];
  updatedAt: string;
};

export type StaffPage = {
  items: StaffItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type TemporaryCredentials = {
  name: string;
  email: string;
  password: string;
};

export type StaffActionState = {
  status: "idle" | "success" | "error" | "conflict";
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
  credentials?: TemporaryCredentials;
};

export const initialStaffActionState: StaffActionState = {
  status: "idle",
  message: "",
};
