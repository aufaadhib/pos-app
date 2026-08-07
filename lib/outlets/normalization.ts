export function normalizeOperationalLabel(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function normalizeOutletName(value: string) {
  return normalizeOperationalLabel(value).toLocaleLowerCase("id-ID");
}

export function normalizeOutletCode(value: string) {
  return value.normalize("NFKC").trim().toUpperCase().replace(/\s+/g, "-");
}

export function suggestOutletCode(value: string) {
  const words = normalizeOperationalLabel(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(" ")
    .filter(Boolean);
  const suggestion = words.length > 1
    ? words.map((word) => word.slice(0, 3)).join("-")
    : words[0]?.slice(0, 12) ?? "";

  return suggestion.replace(/[^A-Z0-9-]/gi, "").toUpperCase().slice(0, 12);
}

/**
 * Parses an Indonesian percentage into a canonical decimal string.
 * Input may use a comma or period and output is null outside the 0-100 range; it has no side effects.
 */
export function parseOutletPercentage(value: string) {
  const match = value.normalize("NFKC").trim().match(/^(\d{1,3})(?:[.,](\d{1,2}))?$/);
  if (!match) return null;
  const hundredths = BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? "").padEnd(2, "0"));
  if (hundredths > BigInt(10_000)) return null;
  return `${hundredths / BigInt(100)}.${String(hundredths % BigInt(100)).padStart(2, "0")}`;
}

export function formatOutletAddress(outlet: {
  addressLine: string | null;
  cityName: string;
  provinceName: string;
}) {
  return [outlet.addressLine, outlet.cityName, outlet.provinceName]
    .filter(Boolean)
    .join(", ");
}
