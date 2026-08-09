const earthRadiusMeters = 6_371_000;

export type Coordinates = { latitude: number; longitude: number };

/** Calculates great-circle distance between two coordinates with the Haversine formula. */
export function distanceInMeters(from: Coordinates, to: Coordinates) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Returns the UTC date representing an outlet-local calendar date for PostgreSQL DATE storage. */
export function businessDateAt(timestamp: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(timestamp);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00.000Z`);
}
