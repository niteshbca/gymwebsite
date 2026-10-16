import { connectDB } from "@/lib/db";
import { Invoice, Payment, Refund, type InvoiceDoc, type PaymentDoc } from "@/models/Payment";
import { Subscription } from "@/models/Subscription";
import { nextSequence } from "@/lib/utils";
import { badRequest, conflict, notFound } from "@/lib/api";
import { sendMail, emailTemplates, escapeHtml } from "@/lib/mailer";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/time";
import { recomputeMoney } from "./subscription";

export interface CreateInvoiceInput {
  memberId: string;
  branchId: string;
  subscriptionId?: string | null;
  items: { label: string; quantity?: number; unitMinor: number }[];
  baseMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  notes?: string;
  createdBy?: string | null;
}

export async function createInvoice(input: CreateInvoiceInput): Promise<InvoiceDoc> {
  await connectDB();
  const number = await nextSequence("invoice", "INV-", 5);
  return Invoice.create({
    invoiceNumber: number,
    member: input.memberId,
    subscription: input.subscriptionId ?? null,
    branch: input.branchId,
    items: input.items.map((i) => ({
      label: i.label,
      quantity: i.quantity ?? 1,
      unitMinor: i.unitMinor,
      totalMinor: i.unitMinor * (i.quantity ?? 1),
    })),
    baseMinor: input.baseMinor,
    discountMinor: input.discountMinor,
    taxMinor: input.taxMinor,
    totalMinor: input.totalMinor,
    paidMinor: 0,
    balanceMinor: input.totalMinor,
    currency: process.env.DEFAULT_CURRENCY || "INR",
    status: "issued",
    notes: input.notes ?? "",
    createdBy: input.createdBy ?? null,
  });
}

export interface RecordPaymentInput {
  invoiceId: string;
  amountMinor: number;
  method: "cash" | "upi" | "card" | "bank_transfer" | "online";
  receivedBy?: string | null;
  notes?: string;
  gateway?: string;
  gatewayRef?: string;
  idempotencyKey?: string;
  markSubscriptionPaid?: boolean;
}

/**
 * Record a payment against an invoice. Idempotency: if the same
 * idempotencyKey is replayed (e.g. gateway webhook retry), the existing
 * payment is returned and NO double-charge / double-credit occurs.
 */
export async function recordPayment(input: RecordPaymentInput): Promise<{ payment: PaymentDoc; replayed: boolean }> {
  await connectDB();
  if (input.idempotencyKey) {
    const existing = await Payment.findOne({ idempotencyKey: input.idempotencyKey });
    if (existing) return { payment: existing, replayed: true };
  }
  const invoice = await Invoice.findById(input.invoiceId);
  if (!invoice) throw notFound("Invoice not found");
  if (invoice.status === "void") throw badRequest("Invoice is void");
  if (invoice.status === "paid") throw conflict("Invoice is already fully paid");

  const amount = Math.round(input.amountMinor);
  if (amount <= 0) throw badRequest("Payment amount must be positive");
  if (amount > invoice.balanceMinor) throw badRequest("Payment exceeds outstanding balance");

  // Online payments are only ever marked success after webhook verification
  // (this service is called from the verified webhook path with gateway set).
  const paymentNumber = await nextSequence("payment", "PAY-", 5);

  const payment = await Payment.create({
    paymentNumber,
    invoice: invoice._id,
    member: invoice.member,
    subscription: invoice.subscription,
    branch: invoice.branch,
    amountMinor: amount,
    method: input.method,
    status: "success",
    gateway: input.gateway ?? "",
    gatewayRef: input.gatewayRef ?? "",
    idempotencyKey: input.idempotencyKey ?? null,
    paidAt: new Date(),
    receivedBy: input.receivedBy ?? null,
    notes: input.notes ?? "",
  });

  invoice.paidMinor += amount;
  invoice.balanceMinor = Math.max(0, invoice.totalMinor - invoice.paidMinor);
  invoice.status = invoice.balanceMinor === 0 ? "paid" : "partial";
  await invoice.save();

  if (invoice.subscription) {
    const sub = await Subscription.findById(invoice.subscription);
    if (sub) {
      sub.amountPaidMinor += amount;
      recomputeMoney(sub);
      if (input.markSubscriptionPaid && sub.paymentStatus === "paid" && sub.status === "pending") {
        sub.status = "active";
        if (!sub.activatedAt) sub.activatedAt = new Date();
      }
      await sub.save();
    }
  }

  // Receipt email — status reported truthfully by sendMail
  const { MemberProfile } = await import("@/models/MemberProfile");
  const member = await MemberProfile.findById(invoice.member).lean();
  if (member?.email) {
    const name = `${member.firstName} ${member.lastName}`.trim();
    const tpl = emailTemplates.receipt(name, invoice.invoiceNumber, formatMoney(amount, process.env.DEFAULT_CURRENCY || "INR"));
    await sendMail({ to: member.email, subject: tpl.subject, html: tpl.html, template: "receipt", entityId: String(payment._id) });
  }

  return { payment, replayed: false };
}

export async function createRefund(opts: {
  paymentId: string;
  amountMinor: number;
  reason: string;
  requestedBy: string;
  approve?: boolean;
  approvedBy?: string;
}) {
  await connectDB();
  const payment = await Payment.findById(opts.paymentId);
  if (!payment) throw notFound("Payment not found");
  if (payment.status !== "success" && payment.status !== "partial_refunded") throw badRequest("Only successful payments can be refunded");
  const alreadyRefunded = await Refund.aggregate([
    { $match: { payment: payment._id, status: { $in: ["approved", "processed", "pending"] } } },
    { $group: { _id: null, total: { $sum: "$amountMinor" } } },
  ]);
  const refunded = alreadyRefunded[0]?.total ?? 0;
  if (opts.amountMinor <= 0 || opts.amountMinor + refunded > payment.amountMinor) {
    throw badRequest("Refund amount exceeds refundable balance");
  }
  const refundNumber = await nextSequence("refund", "REF-", 5);
  const refund = await Refund.create({
    refundNumber,
    payment: payment._id,
    member: payment.member,
    amountMinor: opts.amountMinor,
    reason: opts.reason,
    status: opts.approve ? "approved" : "pending",
    requestedBy: opts.requestedBy,
    approvedBy: opts.approvedBy ?? null,
    processedAt: opts.approve ? new Date() : null,
  });

  if (opts.approve) {
    const invoice = await Invoice.findById(payment.invoice);
    if (invoice) {
      invoice.paidMinor = Math.max(0, invoice.paidMinor - opts.amountMinor);
      invoice.balanceMinor = Math.max(0, invoice.totalMinor - invoice.paidMinor);
      invoice.status = invoice.paidMinor === 0 ? "issued" : invoice.balanceMinor === 0 ? "paid" : "partial";
      await invoice.save();
    }
    if (invoice?.subscription) {
      const sub = await Subscription.findById(invoice.subscription);
      if (sub) {
        sub.amountPaidMinor = Math.max(0, sub.amountPaidMinor - opts.amountMinor);
        recomputeMoney(sub);
        await sub.save();
      }
    }
    payment.status = refunded + opts.amountMinor >= payment.amountMinor ? "refunded" : "partial_refunded";
    await payment.save();
  }
  return refund;
}

export function invoiceJSON(i: InvoiceDoc) {
  return {
    id: String(i._id),
    invoiceNumber: i.invoiceNumber,
    member: String(i.member),
    subscription: i.subscription ? String(i.subscription) : null,
    items: i.items,
    baseMinor: i.baseMinor,
    discountMinor: i.discountMinor,
    taxMinor: i.taxMinor,
    totalMinor: i.totalMinor,
    paidMinor: i.paidMinor,
    balanceMinor: i.balanceMinor,
    currency: i.currency,
    status: i.status,
    issuedAt: i.issuedAt,
    notes: i.notes,
  };
}

export function paymentJSON(p: PaymentDoc) {
  return {
    id: String(p._id),
    paymentNumber: p.paymentNumber,
    invoice: String(p.invoice),
    member: String(p.member),
    subscription: p.subscription ? String(p.subscription) : null,
    amountMinor: p.amountMinor,
    method: p.method,
    status: p.status,
    gateway: p.gateway,
    gatewayRef: p.gatewayRef,
    paidAt: p.paidAt,
    notes: p.notes,
    createdAt: p.createdAt,
  };
}

export async function sendRenewalInviteEmail(memberEmail: string, name: string, renewalUrl: string) {
  const tpl = {
    subject: "Renew your membership",
    html: `<p>Hi ${escapeHtml(name)}, your membership expires soon. <a href="${renewalUrl}">Renew now</a> (valid till ${fmtDate(new Date())}).</p>`,
  };
  return sendMail({ to: memberEmail, subject: tpl.subject, html: tpl.html, template: "renewal_invite" });
}
