import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { withAuth, ok, forbidden, audit, badRequest } from "@/lib/api";
import { loadSubscription, renewSubscription, toSubscriptionJSON, effectiveStatus } from "@/server/services/subscription";
import { createInvoice } from "@/server/services/payment";
import { isSuperScoped } from "@/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({
  startDate: z.coerce.date().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  createInvoice: z.boolean().default(true),
});

/** Renewal creates a NEW subscription; the old one is never overwritten. */
export const POST = withAuth("subscriptions:create", async (req: NextRequest, ctx: Ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  const parent = await loadSubscription(id);
  if (!isSuperScoped(user.role) && String(parent.branch) !== user.branch) throw forbidden();
  if (effectiveStatus(parent) === "cancelled") throw badRequest("Cancelled memberships cannot be renewed");

  const body = schema.parse(await req.json().catch(() => ({})));
  const newSub = await renewSubscription(parent, {
    startDate: body.startDate ?? new Date(),
    discountPercent: body.discountPercent,
    createdBy: user.id,
    activate: true,
  });

  let invoice = null;
  if (body.createInvoice) {
    invoice = await createInvoice({
      memberId: String(parent.member),
      branchId: String(parent.branch),
      subscriptionId: String(newSub._id),
      items: [{ label: `Renewal: ${newSub.planSnapshot.name}`, unitMinor: newSub.baseMinor },
        ...(newSub.joiningFeeMinor > 0 ? [{ label: "Joining fee", unitMinor: newSub.joiningFeeMinor }] : [])],
      baseMinor: newSub.baseMinor,
      discountMinor: newSub.discountMinor,
      taxMinor: newSub.taxMinor,
      totalMinor: newSub.totalMinor,
      notes: `Renewal of ${parent.subscriptionNumber}`,
      createdBy: user.id,
    });
  }

  await audit(user, "subscription.renew", "Subscription", String(newSub._id), { parent: parent.subscriptionNumber });
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        subscription: toSubscriptionJSON(newSub),
        previous: { id: String(parent._id), subscriptionNumber: parent.subscriptionNumber, status: parent.status },
        invoice: invoice ? { id: String(invoice._id), invoiceNumber: invoice.invoiceNumber, totalMinor: invoice.totalMinor } : null,
      },
    }),
    { status: 201 },
  );
});
