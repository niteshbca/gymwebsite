import { format, addDays, startOfDay, endOfDay } from "date-fns";

export const tz = () => process.env.APP_TIMEZONE || "Asia/Kolkata";

/** Format a date in the gym's configured timezone. */
export function fmtDate(d: Date | string | number | null | undefined, pattern = "dd MMM yyyy"): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, pattern);
}

export function fmtDateTime(d: Date | string | number | null | undefined): string {
  return fmtDate(d, "dd MMM yyyy, hh:mm a");
}

/** Days until expiry (negative = past). */
export function daysUntil(endDate: Date, now = new Date()): number {
  const a = startOfDay(endDate).getTime();
  const b = startOfDay(now).getTime();
  return Math.round((a - b) / 86400000);
}

export { addDays, startOfDay, endOfDay };

/** Human status label helpers */
export function subStatusLabel(status: string) {
  switch (status) {
    case "pending": return "Pending";
    case "active": return "Active";
    case "frozen": return "Frozen";
    case "expired": return "Expired";
    case "cancelled": return "Cancelled";
    case "pending_renewal": return "Pending Renewal";
    default: return status;
  }
}
