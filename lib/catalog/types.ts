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
  role?: "owner" | "manager" | "cashier";
};

export type VariantOptionItem = {
  id: string;
  name: string;
  priceAdjustment: string;
  displayOrder: number;
  status: "ACTIVE" | "ARCHIVED";
  updatedAt: string;
};

export type VariantGroupItem = {
  id: string;
  productId: string;
  name: string;
  displayOrder: number;
  status: "ACTIVE" | "ARCHIVED";
  updatedAt: string;
  options: VariantOptionItem[];
};

export type ModifierOptionItem = VariantOptionItem;

export type ModifierGroupItem = {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
  updatedAt: string;
  options: ModifierOptionItem[];
};

export type ProductModifierItem = {
  modifierGroupId: string;
  modifierGroupName: string;
  minSelections: number;
  maxSelections: number;
  displayOrder: number;
  status: "ACTIVE" | "ARCHIVED";
  updatedAt: string;
};

export type AdvancedProductItem = CatalogProductItem & {
  variantGroups: VariantGroupItem[];
  modifierGroups: ProductModifierItem[];
};

export type OutletCatalogProductItem = CatalogProductItem & {
  effectiveBasePrice: string;
  isAvailable: boolean;
  hasPriceOverride: boolean;
  overrideUpdatedAt: string | null;
  variantGroups: Array<Omit<VariantGroupItem, "options"> & {
    options: Array<VariantOptionItem & {
      effectivePriceAdjustment: string;
      isAvailable: boolean;
      hasPriceOverride: boolean;
      overrideUpdatedAt: string | null;
    }>;
  }>;
};

export type OutletCatalogProductPage = Omit<CatalogProductPage, "items"> & {
  items: OutletCatalogProductItem[];
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
