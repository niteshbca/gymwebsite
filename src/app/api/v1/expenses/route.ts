import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Expense } from "@/models/Lead";
import { withAuth, okPage, ok, audit, scopeFor } from "@/lib/api";
import { parsePaging, parseDateRange } from "@/lib/utils";

export const GET = withAuth("expenses:read", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const url = new URL(req.url);
  const { page, size, skip, limit } = parsePaging(url);
  const filter: Record<string, unknown> = scopeFor(user);
  const range = parseDateRange(url);
  if (range.from || range.to) {
    filter.date = {};
    if (range.from) (filter.date as Record<string, Date>).$gte = range.from;
    if (range.to) (filter.date as Record<string, Date>).$lte = range.to;
  }
  const status = url.searchParams.get("status");
  if (status) filter.status = status;
  const [items, total] = await Promise.all([
    Expense.find(filter).sort({ date: -1 }).skip(skip).limit(limit)
      .populate("category", "name").populate("vendor", "name").lean(),
    Expense.countDocuments(filter),
  ]);
  return okPage(items.map((e) => ({ ...e, id: String(e._id) })), total, page, size);
});

const schema = z.object({
  title: z.string().min(2).max(150),
  amountMinor: z.number().int().min(1),
  date: z.coerce.date(),
  category: z.string().min(1),
  vendor: z.string().nullable().default(null),
  branch: z.string().min(1),
  paymentMethod: z.string().default("cash"),
  billNumber: z.string().max(60).default(""),
  notes: z.string().max(1000).default(""),
  status: z.enum(["pending", "approved", "rejected", "paid"]).default("paid"),
});

export const POST = withAuth("expenses:create", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const body = schema.parse(await req.json());
  const expense = await Expense.create({
    ...body,
    createdBy: user.id,
    approvedBy: body.status === "approved" || body.status === "paid" ? user.id : null,
  });
  await audit(user, "expense.create", "Expense", String(expense._id), { amountMinor: body.amountMinor });
  return new Response(JSON.stringify({ success: true, data: { ...expense.toObject(), id: String(expense._id) } }), { status: 201 });
});
