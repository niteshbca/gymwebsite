import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { AuditLog } from "@/models/System";
import { withAuth, okPage } from "@/lib/api";
import { parsePaging, parseDateRange } from "@/lib/utils";

export const GET = withAuth("audit:read", async (req: NextRequest) => {
  await connectDB();
  const url = new URL(req.url);
  const { page, size, skip, limit } = parsePaging(url);
  const filter: Record<string, unknown> = {};
  const entity = url.searchParams.get("entity");
  if (entity) filter.entity = entity;
  const actor = url.searchParams.get("actor");
  if (actor) filter.actor = actor;
  const range = parseDateRange(url);
  if (range.from || range.to) {
    filter.createdAt = {};
    if (range.from) (filter.createdAt as Record<string, Date>).$gte = range.from;
    if (range.to) (filter.createdAt as Record<string, Date>).$lte = range.to;
  }
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return okPage(items.map((a) => ({ ...a, id: String(a._id) })), total, page, size);
});
