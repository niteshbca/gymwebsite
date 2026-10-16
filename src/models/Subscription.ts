import mongoose, { Schema, type Model } from "mongoose";

export type SubscriptionStatus = "pending" | "active" | "frozen" | "expired" | "cancelled" | "pending_renewal";

export interface SubscriptionDoc extends mongoose.Document {
  subscriptionNumber: string;
  member: mongoose.Types.ObjectId;
  branch: mongoose.Types.ObjectId;
  plan: mongoose.Types.ObjectId;
  /** Immutable snapshot of plan at purchase time — plan changes never rewrite history. */
  planSnapshot: {
    name: string;
    code: string;
    durationValue: number;
    durationUnit: string;
    priceMinor: number;
    taxPercent: number;
    taxInclusive: boolean;
    joiningFeeMinor: number;
    freezeAllowed: boolean;
    maxFreezes: number;
    freezeDaysMax: number;
    classAccess: string;
    accessHours: { from: string; to: string } | null;
  };
  startDate: Date;
  endDate: Date;
  activatedAt: Date | null;
  status: SubscriptionStatus;
  trainer: mongoose.Types.ObjectId | null;
  discountPercent: number;
  discountReason: string;
  baseMinor: number;
  discountMinor: number;
  taxMinor: number;
  joiningFeeMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  balanceMinor: number;
  paymentStatus: "unpaid" | "partial" | "paid";
  freezeCount: number;
  frozenDaysTotal: number;
  frozenUntil: Date | null;
  source: "reception" | "online" | "renewal" | "upgrade";
  parentSubscription: mongoose.Types.ObjectId | null;
  notes: string;
  cancelledAt: Date | null;
  cancelReason: string;
  createdBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<SubscriptionDoc>(
  {
    subscriptionNumber: { type: String, required: true, unique: true, index: true },
    member: { type: Schema.Types.ObjectId, ref: "MemberProfile", required: true, index: true },
    branch: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    plan: { type: Schema.Types.ObjectId, ref: "MembershipPlan", required: true },
    planSnapshot: {
      type: {
        name: String, code: String, durationValue: Number, durationUnit: String,
        priceMinor: Number, taxPercent: Number, taxInclusive: Boolean, joiningFeeMinor: Number,
        freezeAllowed: Boolean, maxFreezes: Number, freezeDaysMax: Number,
        classAccess: String, accessHours: { type: { from: String, to: String }, default: null },
      },
      required: true,
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    activatedAt: { type: Date, default: null },
    status: { type: String, enum: ["pending", "active", "frozen", "expired", "cancelled", "pending_renewal"], default: "pending", index: true },
    trainer: { type: Schema.Types.ObjectId, ref: "TrainerProfile", default: null },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    discountReason: { type: String, default: "" },
    baseMinor: { type: Number, required: true, min: 0 },
    discountMinor: { type: Number, default: 0, min: 0 },
    taxMinor: { type: Number, default: 0, min: 0 },
    joiningFeeMinor: { type: Number, default: 0, min: 0 },
    totalMinor: { type: Number, required: true, min: 0 },
    amountPaidMinor: { type: Number, default: 0, min: 0 },
    balanceMinor: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ["unpaid", "partial", "paid"], default: "unpaid", index: true },
    freezeCount: { type: Number, default: 0 },
    frozenDaysTotal: { type: Number, default: 0 },
    frozenUntil: { type: Date, default: null },
    source: { type: String, enum: ["reception", "online", "renewal", "upgrade"], default: "reception" },
    parentSubscription: { type: Schema.Types.ObjectId, ref: "Subscription", default: null },
    notes: { type: String, default: "" },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

SubscriptionSchema.index({ member: 1, status: 1 });
SubscriptionSchema.index({ status: 1, endDate: 1 });
SubscriptionSchema.index({ branch: 1, status: 1, endDate: 1 });

export const Subscription: Model<SubscriptionDoc> =
  mongoose.models.Subscription ?? mongoose.model<SubscriptionDoc>("Subscription", SubscriptionSchema);
