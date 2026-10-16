import { NextRequest } from "next/server";
import { z } from "zod";

import { connectDB } from "@/lib/db";
import { Payment, Invoice } from "@/models/Payment";
import { withPublic, ok, badRequest, unauthorized } from "@/lib/api";
import { verifyWebhookSignature } from "@/lib/crypto";
import { recordPayment } from "@/server/services/payment";
import { env } from "@/lib/env";

const webhookSchema = z.object({
  eventId: z.string().min(5),
  paymentId: z.string().min(3),
  invoiceId: z.string().min(3),
  status: z.enum(["success", "failed"]),
  amountMinor: z.number().int().min(1),
});

/**
 * Gateway webhook. Server-side signature verification + idempotency:
 * replaying the same eventId can never double-charge or double-credit.
 */
export const POST = withPublic(async (req: NextRequest) => {
  if (!env.PAYMENT_WEBHOOK_SECRET) {
    throw unauthorized("Payment gateway webhook is not configured (PAYMENT_WEBHOOK_SECRET missing)");
  }
  const rawBody = await req.text();
  const signature = req.headers.get("x-fitpro-signature");
  if (!verifyWebhookSignature(rawBody, signature)) {
    throw unauthorized("Invalid webhook signature");
  }
  const body = webhookSchema.parse(JSON.parse(rawBody));
  await connectDB();

  if (body.status === "failed") {
    await Payment.updateOne(
      { gatewayRef: body.paymentId },
      { $set: { status: "failed", meta: { webhookEvent: body.eventId } } },
    );
    return ok({ processed: "failed_recorded" });
  }

  const invoice = await Invoice.findById(body.invoiceId);
  if (!invoice) throw badRequest("Unknown invoice");

  const { payment, replayed } = await recordPayment({
    invoiceId: body.invoiceId,
    amountMinor: body.amountMinor,
    method: "online",
    gateway: env.PAYMENT_GATEWAY,
    gatewayRef: body.paymentId,
    idempotencyKey: `webhook:${body.eventId}`,
    markSubscriptionPaid: true,
    notes: "Verified gateway payment",
  });

  return ok({ processed: replayed ? "duplicate_ignored" : "success", paymentId: String(payment._id) });
});


