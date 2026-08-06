const whitespacePattern = /\s+/g;

export function normalizeCatalogName(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(whitespacePattern, " ")
    .toLocaleLowerCase("id-ID");
}

export function normalizeCatalogLabel(value: string) {
  return value.normalize("NFKC").trim().replace(whitespacePattern, " ");
}

export function normalizeSku(value: string | null | undefined) {
  const normalized = value?.normalize("NFKC").trim().toUpperCase() ?? "";
  return normalized.length > 0 ? normalized : null;
}

export function parseRupiahToMinorUnit(value: string) {
  const normalized = value.normalize("NFKC").trim();

  if (!/^\s*(?:Rp\s*)?[\d.]+\s*$/i.test(normalized)) {
    return null;
  }

  const digits = normalized.replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  const amount = BigInt(digits);
  if (amount <= BigInt(0) || amount > BigInt(999_999_999)) {
    return null;
  }

  return amount.toString();
}

export function formatRupiah(value: string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(BigInt(value.split(".")[0] ?? "0"));
}

export function getProductMonogram(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("id-ID"))
    .join("");
}
