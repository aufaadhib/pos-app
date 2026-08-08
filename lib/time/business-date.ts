/** Converts one instant into an outlet-local PostgreSQL date and receipt token. */
export function getOutletBusinessDate(timezone: string, instant = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const value = `${values.year}-${values.month}-${values.day}`;
  return {
    date: new Date(`${value}T00:00:00.000Z`),
    token: value.replaceAll("-", ""),
    value,
  };
}
