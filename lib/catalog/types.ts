export const catalogStatuses = ["active", "archived", "all"] as const;

export type CatalogStatusFilter = (typeof catalogStatuses)[number];

export type CatalogActionState = {
  status: "idle" | "success" | "error" | "conflict";
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export type CatalogActor = {
  id: string;
  email: string;
};

export type CatalogCategoryItem = {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
  status: "ACTIVE" | "ARCHIVED";
  updatedAt: string;
  activeProductCount: number;
  totalProductCount: number;
};

export type CatalogProductItem = {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryStatus: "ACTIVE" | "ARCHIVED";
  name: string;
  sku: string | null;
  description: string | null;
  basePrice: string;
  displayOrder: number;
  status: "ACTIVE" | "ARCHIVED";
  updatedAt: string;
};

export type CatalogProductPage = {
  items: CatalogProductItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export const initialCatalogActionState: CatalogActionState = {
  status: "idle",
  message: "",
};
