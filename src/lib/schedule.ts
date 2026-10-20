import { addDays, startOfDay } from "date-fns";

/** Next upcoming occurrence date for a weekly recurring class (local timezone). */
export function nextOccurrence(dayOfWeek: number, now = new Date()): Date {
  const today = startOfDay(now);
  const diff = (dayOfWeek - today.getDay() + 7) % 7;
  return addDays(today, diff === 0 && now.getHours() >= 18 ? 7 : diff);
}

/** Local-timezone YYYY-MM-DD (toISOString would shift across timezones). */
export function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
