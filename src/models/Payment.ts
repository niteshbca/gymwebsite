import mongoose, { Schema, type Model } from "mongoose";

export const PAYMENT_METHODS = ["cash", "upi", "card", "bank_transfer", "online"] as const;

export interface PaymentDoc extends mongoose.Document {
  paymentNumber: string;
  invoice: mongoose.Types.ObjectId;
  member: mongoose.Types.ObjectId;
  subscription: mongoose.Types.ObjectId | null;
  branch: mongoose.Types.ObjectId;
  amountMinor: number;
  method: (typeof PAYMENT_METHODS)[number];
  status: "pending" | "success" | "failed" | "refunded" | "partial_refunded";
  gateway?: string;
  gatewayRef?: string;
  /** Idempotency: unique key prevents duplicate processing of webhooks/retries. */
  idempotencyKey?: string | null;
  paidAt: Date | null;
  receivedBy: mongoose.Types.ObjectId | null;
  notes: string;
  meta: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<PaymentDoc>(
  {
    paymentNumber: { type: String, required: true, unique: true, index: true },
    invoice: { type: Schema.Types.ObjectId, ref: "Invoice", required: true, index: true },
    member: { type: Schema.Types.ObjectId, ref: "MemberProfile", required: true, index: true },
    subscription: { type: Schema.Types.ObjectId, ref: "Subscription", default: null, index: true },
    branch: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    amountMinor: { type: Number, required: true, min: 1 },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    status: { type: String, enum: ["pending", "success", "failed", "refunded", "partial_refunded"], default: "pending", index: true },
    gateway: { type: String, default: "" },
    gatewayRef: { type: String, default: "", index: true },
    idempotencyKey: { type: String, default: null },
    paidAt: { type: Date, default: null },
    receivedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    notes: { type: String, default: "" },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

PaymentSchema.index({ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } });
PaymentSchema.index({ branch: 1, status: 1, paidAt: -1 });

export const Payment: Model<PaymentDoc> = mongoose.models.Payment ?? mongoose.model<PaymentDoc>("Payment", PaymentSchema);

export interface InvoiceDoc extends mongoose.Document {
  invoiceNumber: string;
  member: mongoose.Types.ObjectId;
  subscription: mongoose.Types.ObjectId | null;
  branch: mongoose.Types.ObjectId;
  items: { label: string; quantity: number; unitMinor: number; totalMinor: number }[];
  baseMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  paidMinor: number;
  balanceMinor: number;
  currency: string;
  status: "draft" | "issued" | "paid" | "partial" | "void";
  issuedAt: Date;
  notes: string;
  createdBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<InvoiceDoc>(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    member: { type: Schema.Types.ObjectId, ref: "MemberProfile", required: true, index: true },
    subscription: { type: Schema.Types.ObjectId, ref: "Subscription", default: null },
    branch: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    items: {
      type: [{ label: String, quantity: { type: Number, default: 1 }, unitMinor: Number, totalMinor: Number }],
      default: [],
    },
    baseMinor: { type: Number, required: true, min: 0 },
    discountMinor: { type: Number, default: 0, min: 0 },
    taxMinor: { type: Number, default: 0, min: 0 },
    totalMinor: { type: Number, required: true, min: 0 },
    paidMinor: { type: Number, default: 0, min: 0 },
    balanceMinor: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },
    status: { type: String, enum: ["draft", "issued", "paid", "partial", "void"], default: "issued", index: true },
    issuedAt: { type: Date, default: Date.now },
    notes: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export const Invoice: Model<InvoiceDoc> = mongoose.models.Invoice ?? mongoose.model<InvoiceDoc>("Invoice", InvoiceSchema);

export interface RefundDoc extends mongoose.Document {
  refundNumber: string;
  payment: mongoose.Types.ObjectId;
  member: mongoose.Types.ObjectId;
  amountMinor: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "processed";
  requestedBy: mongoose.Types.ObjectId | null;
  approvedBy: mongoose.Types.ObjectId | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const RefundSchema = new Schema<RefundDoc>(
  {
    refundNumber: { type: String, required: true, unique: true },
    payment: { type: Schema.Types.ObjectId, ref: "Payment", required: true, index: true },
    member: { type: Schema.Types.ObjectId, ref: "MemberProfile", required: true },
    amountMinor: { type: Number, required: true, min: 1 },
    reason: { type: String, default: "" },
    status: { type: String, enum: ["pending", "approved", "rejected", "processed"], default: "pending" },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Refund: Model<RefundDoc> = mongoose.models.Refund ?? mongoose.model<RefundDoc>("Refund", RefundSchema);
