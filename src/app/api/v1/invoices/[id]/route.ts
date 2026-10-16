import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Invoice } from "@/models/Payment";
import { withAuth, ok, notFound, forbidden } from "@/lib/api";
import { invoiceJSON } from "@/server/services/payment";
import { isSuperScoped } from "@/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth("payments:read", async (_req: NextRequest, ctx: Ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) throw notFound("Invoice not found");
  const invoice = await Invoice.findById(id)
    .populate("member", "memberNumber firstName lastName phone email address")
    .populate("subscription", "subscriptionNumber startDate endDate status planSnapshot")
    .lean();
  if (!invoice) throw notFound("Invoice not found");
  if (!isSuperScoped(user.role) && String(invoice.branch) !== user.branch) throw forbidden();
  return ok({ ...invoiceJSON(invoice as never), member: invoice.member, subscription: invoice.subscription });
});
