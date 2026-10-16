import { connectDB } from "./db";

/**
 * Atomic counter-based document numbering (member no, invoice no, etc.).
 * Uses a single counter document with $inc — safe under concurrency.
 */
export async function nextSequence(name: string, prefix: string, pad = 5): Promise<string> {
  await connectDB();
  const { Counter } = await import("@/models/System");
  const doc = await Counter.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  ).lean();
  const seq = (doc as unknown as { seq: number }).seq;
  return `${prefix}${String(seq).padStart(pad, "0")}`;
}

/** CSV export with spreadsheet-formula-injection protection. */
export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  if (rows.length === 0) return "";
  const cols = columns ?? Object.keys(rows[0]);
  const escape = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = cols.map(escape).join(",");
  const body = rows.map((r) => cols.map((c) => escape(r[c])).join(",")).join("\n");
  return `${header}\n${body}`;
}

export function csvResponse(rows: Record<string, unknown>[], filename: string, columns?: string[]) {
  const csv = toCsv(rows, columns);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Safe pagination parsing. */
export function parsePaging(url: URL, defaultSize = 20, maxSize = 100) {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const size = Math.min(maxSize, Math.max(1, Number(url.searchParams.get("pageSize") ?? defaultSize) || defaultSize));
  return { page, size, skip: (page - 1) * size, limit: size };
}

/** Build a safe Mongo filter from allowed sort keys. */
export function parseSort(url: URL, allowed: string[], fallback = "-createdAt") {
  const key = url.searchParams.get("sort") ?? fallback;
  const dir = url.searchParams.get("dir") === "asc" ? 1 : -1;
  const field = allowed.includes(key.replace(/^-/, "")) ? key.replace(/^-/, "") : fallback.replace(/^-/, "");
  const sign = key.startsWith("-") || dir === -1 ? -1 : 1;
  return { [field]: sign } as Record<string, 1 | -1>;
}

export function parseDateRange(url: URL) {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const out: { from?: Date; to?: Date } = {};
  if (from && !Number.isNaN(Date.parse(from))) out.from = new Date(from);
  if (to && !Number.isNaN(Date.parse(to))) {
    const d = new Date(to);
    d.setHours(23, 59, 59, 999);
    out.to = d;
  }
  return out;
}
