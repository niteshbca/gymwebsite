import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Payment } from "@/models/Payment";
import { withAuth, ok, notFound, forbidden, badRequest, audit } from "@/lib/api";
import { createRefund, paymentJSON } from "@/server/services/payment";
import { isSuperScoped } from "@/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ amountMinor: z.number().int().min(1), reason: z.string().min(3).max(500), approve: z.boolean().default(true) });

export const POST = withAuth("payments:refund", async (req: NextRequest, ctx: Ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  const payment = await Payment.findById(id);
  if (!payment) throw notFound("Payment not found");
  if (!isSuperScoped(user.role) && String(payment.branch) !== user.branch) throw forbidden();
  if (payment.method === "online" && !envHasGateway()) {
    // still allow refund record; gateway payout is manual
  }
  const body = schema.parse(await req.json());
  const refund = await createRefund({
    paymentId: id,
    amountMinor: body.amountMinor,
    reason: body.reason,
    requestedBy: user.id,
    approve: body.approve,
    approvedBy: body.approve ? user.id : undefined,
  });
  await audit(user, "payment.refund", "Refund", String(refund._id), { amountMinor: body.amountMinor });
  return new Response(JSON.stringify({ success: true, data: { ...refund.toObject(), id: String(refund._id) } }), { status: 201 });
});

export const GET = withAuth("payments:read", async (_req: NextRequest, ctx: Ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  const payment = await Payment.findById(id);
  if (!payment) throw notFound("Payment not found");
  if (!isSuperScoped(user.role) && String(payment.branch) !== user.branch) throw forbidden();
  return ok(paymentJSON(payment));
});

function envHasGateway() {
  return (process.env.PAYMENT_GATEWAY ?? "manual") !== "manual";
}
void badRequest;
