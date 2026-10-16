import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Payment, Invoice } from "@/models/Payment";
import { withAuth, okPage, ok, badRequest, audit, scopeFor } from "@/lib/api";
import { parsePaging, parseDateRange } from "@/lib/utils";
import { recordPayment, paymentJSON, createInvoice } from "@/server/services/payment";
import { getSettings } from "@/models/GymSettings";

export const GET = withAuth("payments:read", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const url = new URL(req.url);
  const { page, size, skip, limit } = parsePaging(url);
  const filter: Record<string, unknown> = { ...scopeFor(user), status: { $ne: "pending" } };
  const range = parseDateRange(url);
  if (range.from || range.to) {
    filter.paidAt = {};
    if (range.from) (filter.paidAt as Record<string, Date>).$gte = range.from;
    if (range.to) (filter.paidAt as Record<string, Date>).$lte = range.to;
  }
  const method = url.searchParams.get("method");
  if (method) filter.method = method;
  const [items, total] = await Promise.all([
    Payment.find(filter).sort({ paidAt: -1 }).skip(skip).limit(limit)
      .populate("member", "memberNumber firstName lastName").lean(),
    Payment.countDocuments(filter),
  ]);
  return okPage(items.map((p) => ({ ...paymentJSON(p as never), member: p.member })), total, page, size);
});

const createSchema = z.object({
  invoiceId: z.string().min(1),
  amountMinor: z.number().int().min(1),
  method: z.enum(["cash", "upi", "card", "bank_transfer", "online"]),
  notes: z.string().max(500).default(""),
  idempotencyKey: z.string().max(120).optional(),
});

/** Manual payment entry (cash/UPI/card at front desk). Online gateway payments
 *  must go through POST /payments/webhook after signature verification. */
export const POST = withAuth("payments:create", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const body = createSchema.parse(await req.json());
  if (body.method === "online") {
    throw badRequest("Online payments must be confirmed via the gateway webhook, not entered manually");
  }
  const settings = await getSettings();
  const invoice = await Invoice.findById(body.invoiceId).lean();
  if (!invoice) throw badRequest("Invoice not found");
  if (!settings.allowPartialPayments && body.amountMinor < invoice.balanceMinor) {
    throw badRequest("Partial payments are disabled in settings");
  }
  const { payment, replayed } = await recordPayment({
    invoiceId: body.invoiceId,
    amountMinor: body.amountMinor,
    method: body.method,
    receivedBy: user.id,
    notes: body.notes,
    idempotencyKey: body.idempotencyKey,
    markSubscriptionPaid: true,
  });
  if (replayed) return ok({ payment: paymentJSON(payment), replayed: true });
  await audit(user, "payment.record", "Payment", String(payment._id), { amountMinor: body.amountMinor, method: body.method });
  return new Response(JSON.stringify({ success: true, data: { payment: paymentJSON(payment), replayed: false } }), { status: 201 });
});
