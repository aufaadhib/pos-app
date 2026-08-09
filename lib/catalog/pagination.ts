export type CatalogPaginationItem = number | "start-ellipsis" | "end-ellipsis";

/** Builds a compact page-number window around the current catalog page. */
export function getCatalogPaginationItems(currentPage: number, totalPages: number): CatalogPaginationItem[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (currentPage <= 3) return [1, 2, 3, 4, "end-ellipsis", totalPages];
  if (currentPage >= totalPages - 2) return [1, "start-ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "start-ellipsis", currentPage - 1, currentPage, currentPage + 1, "end-ellipsis", totalPages];
}
