const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Formats one canonical decimal or whole value as rounded Rupiah without decimal digits. */
export function formatRupiah(value: string | bigint): string {
  if (typeof value === "bigint") return rupiahFormatter.format(value);

  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) throw new RangeError("Nilai Rupiah tidak valid.");

  const fraction = match[3] ?? "";
  const rounded = BigInt(match[2]) + (fraction[0] && fraction[0] >= "5" ? 1n : 0n);
  return rupiahFormatter.format(match[1] ? -rounded : rounded);
}

/** Converts integer minor units to rounded whole Rupiah for display without floating-point arithmetic. */
export function formatRupiahFromMinor(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const rounded = (absolute + 50n) / 100n;
  return rupiahFormatter.format(negative ? -rounded : rounded);
}
