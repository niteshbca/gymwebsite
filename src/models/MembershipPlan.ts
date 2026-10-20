import mongoose, { Schema, type Model } from "mongoose";

export type PlanDurationUnit = "day" | "week" | "month" | "year";
export type PlanCategory = "membership" | "personal_training" | "class_package" | "one_time";

export interface MembershipPlanDoc extends mongoose.Document {
  name: string;
  code: string;
  description: string;
  image: string;
  features: string[];
  popular: boolean;
  category: PlanCategory;
  durationValue: number;
  durationUnit: PlanDurationUnit;
  priceMinor: number;
  taxPercent: number;
  taxInclusive: boolean;
  joiningFeeMinor: number;
  discountEligible: boolean;
  includedSessions: number;
  accessHours: { from: string; to: string } | null; // null = all hours
  branchAccess: "home" | "all";
  branches: mongoose.Types.ObjectId[];
  classAccess: "none" | "group" | "all";
  freezeAllowed: boolean;
  maxFreezes: number;
  freezeDaysMax: number;
  cancellationRefundPercent: number;
  renewalRuleDays: number;
  guestPasses: number;
  trainerIncluded: boolean;
  priceHistory: { priceMinor: number; taxPercent: number; changedAt: Date; changedBy: string }[];
  active: boolean;
  archived: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const MembershipPlanSchema = new Schema<MembershipPlanDoc>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: "" },
    image: { type: String, default: "" },
    features: { type: [String], default: [] },
    popular: { type: Boolean, default: false },
    category: { type: String, enum: ["membership", "personal_training", "class_package", "one_time"], default: "membership" },
    durationValue: { type: Number, required: true, min: 1 },
    durationUnit: { type: String, enum: ["day", "week", "month", "year"], default: "month" },
    priceMinor: { type: Number, required: true, min: 0 },
    taxPercent: { type: Number, default: 18, min: 0, max: 100 },
    taxInclusive: { type: Boolean, default: false },
    joiningFeeMinor: { type: Number, default: 0, min: 0 },
    discountEligible: { type: Boolean, default: true },
    includedSessions: { type: Number, default: 0 },
    accessHours: { type: { from: String, to: String }, default: null },
    branchAccess: { type: String, enum: ["home", "all"], default: "home" },
    branches: { type: [Schema.Types.ObjectId], ref: "Branch", default: [] },
    classAccess: { type: String, enum: ["none", "group", "all"], default: "group" },
    freezeAllowed: { type: Boolean, default: true },
    maxFreezes: { type: Number, default: 2 },
    freezeDaysMax: { type: Number, default: 30 },
    cancellationRefundPercent: { type: Number, default: 0, min: 0, max: 100 },
    renewalRuleDays: { type: Number, default: 0 },
    guestPasses: { type: Number, default: 0 },
    trainerIncluded: { type: Boolean, default: false },
    priceHistory: { type: [{ priceMinor: Number, taxPercent: Number, changedAt: Date, changedBy: String }], default: [] },
    active: { type: Boolean, default: true, index: true },
    archived: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

MembershipPlanSchema.index({ active: 1, archived: 1, sortOrder: 1 });

export const MembershipPlan: Model<MembershipPlanDoc> =
  mongoose.models.MembershipPlan ?? mongoose.model<MembershipPlanDoc>("MembershipPlan", MembershipPlanSchema);

/** Compute end date from plan duration (calendar-aware for months/years). */
export function computePlanEndDate(start: Date, unit: PlanDurationUnit, value: number): Date {
  const d = new Date(start.getTime());
  switch (unit) {
    case "day":
      d.setDate(d.getDate() + value);
      break;
    case "week":
      d.setDate(d.getDate() + value * 7);
      break;
    case "month":
      d.setMonth(d.getMonth() + value);
      break;
    case "year":
      d.setFullYear(d.getFullYear() + value);
      break;
  }
  return d;
}
