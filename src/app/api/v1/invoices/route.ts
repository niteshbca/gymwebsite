import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Invoice } from "@/models/Payment";
import { withAuth, okPage, audit, scopeFor } from "@/lib/api";
import { parsePaging, parseDateRange } from "@/lib/utils";
import { invoiceJSON, createInvoice } from "@/server/services/payment";

export const GET = withAuth("payments:read", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const url = new URL(req.url);
  const { page, size, skip, limit } = parsePaging(url);
  const filter: Record<string, unknown> = scopeFor(user);
  const member = url.searchParams.get("member");
  if (member) filter.member = member;
  const status = url.searchParams.get("status");
  if (status) filter.status = status;
  const range = parseDateRange(url);
  if (range.from || range.to) {
    filter.issuedAt = {};
    if (range.from) (filter.issuedAt as Record<string, Date>).$gte = range.from;
    if (range.to) (filter.issuedAt as Record<string, Date>).$lte = range.to;
  }
  const [items, total] = await Promise.all([
    Invoice.find(filter).sort({ issuedAt: -1 }).skip(skip).limit(limit)
      .populate("member", "memberNumber firstName lastName phone").lean(),
    Invoice.countDocuments(filter),
  ]);
  return okPage(items.map((i) => ({ ...invoiceJSON(i as never), member: i.member })), total, page, size);
});

const createSchema = z.object({
  member: z.string().min(1),
  branch: z.string().min(1),
  subscription: z.string().nullable().optional(),
  items: z.array(z.object({ label: z.string().min(1), quantity: z.number().int().min(1).default(1), unitMinor: z.number().int().min(0) })).min(1),
  notes: z.string().max(500).default(""),
});

export const POST = withAuth("payments:create", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const body = createSchema.parse(await req.json());
  const baseMinor = body.items.reduce((s, i) => s + i.unitMinor * i.quantity, 0);
  const invoice = await createInvoice({
    memberId: body.member,
    branchId: body.branch,
    subscriptionId: body.subscription ?? null,
    items: body.items,
    baseMinor,
    discountMinor: 0,
    taxMinor: 0,
    totalMinor: baseMinor,
    notes: body.notes,
    createdBy: user.id,
  });
  await audit(user, "invoice.create", "Invoice", String(invoice._id), { invoiceNumber: invoice.invoiceNumber });
  return new Response(JSON.stringify({ success: true, data: invoiceJSON(invoice) }), { status: 201 });
});
