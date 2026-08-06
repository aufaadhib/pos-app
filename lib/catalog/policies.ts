export type CatalogPolicyErrorCode =
  | "CONFLICT"
  | "CATEGORY_ARCHIVED"
  | "CATEGORY_HAS_ACTIVE_PRODUCTS";

export class CatalogPolicyError extends Error {
  constructor(
    public readonly code: CatalogPolicyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CatalogPolicyError";
  }
}

export function assertCatalogVersion(actual: Date, expected: string) {
  if (actual.getTime() !== new Date(expected).getTime()) {
    throw new CatalogPolicyError(
      "CONFLICT",
      "Data telah diubah oleh pengguna lain. Muat ulang lalu coba kembali.",
    );
  }
}

export function assertCategoryCanArchive(activeProductCount: number) {
  if (activeProductCount > 0) {
    throw new CatalogPolicyError(
      "CATEGORY_HAS_ACTIVE_PRODUCTS",
      "Arsipkan seluruh produk aktif dalam kategori ini terlebih dahulu.",
    );
  }
}

export function assertProductCanRestore(categoryStatus: "ACTIVE" | "ARCHIVED") {
  if (categoryStatus !== "ACTIVE") {
    throw new CatalogPolicyError(
      "CATEGORY_ARCHIVED",
      "Pulihkan kategori produk terlebih dahulu.",
    );
  }
}
