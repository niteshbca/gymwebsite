import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Payment, Invoice } from "@/models/Payment";
import { withAuth, ok, scopeFor, forbidden } from "@/lib/api";
import { isSuperScoped } from "@/lib/rbac";
import { formatMoney } from "@/lib/money";

/** Public payment status check by gateway paymentId (for checkout polling). */
export const GET = withAuth(null, async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const url = new URL(req.url);
  const paymentId = url.searchParams.get("paymentId");
  if (!paymentId) throw forbidden("paymentId required");
  const payment = await Payment.findOne({ gatewayRef: paymentId });
  if (!payment) return ok({ status: "unknown" });
  if (!isSuperScoped(user.role) && user.role !== "member") {
    if (String(payment.branch) !== user.branch) throw forbidden();
  }
  if (user.role === "member") {
    const invoice = await Invoice.findById(payment.invoice).lean();
    if (!invoice || String(invoice.member) !== user.memberProfile) throw forbidden();
  }
  void scopeFor; void formatMoney;
  return ok({ status: payment.status, amountMinor: payment.amountMinor, paymentNumber: payment.paymentNumber, paidAt: payment.paidAt });
});
