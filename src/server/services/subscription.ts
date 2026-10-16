import { connectDB } from "@/lib/db";
import { computePlanEndDate, type MembershipPlanDoc } from "@/models/MembershipPlan";
import { Subscription, type SubscriptionDoc, type SubscriptionStatus } from "@/models/Subscription";
import { computePrice } from "@/lib/money";
import { nextSequence } from "@/lib/utils";
import { badRequest, conflict, notFound } from "@/lib/api";
import { Types } from "mongoose";

export type Transition =
  | "activate"
  | "freeze"
  | "unfreeze"
  | "cancel"
  | "expire"
  | "extend"
  | "reactivate"
  | "mark_pending";

/**
 * Explicit allowed transitions. Anything else is rejected — no silent state changes.
 */
const ALLOWED: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  pending: ["active", "cancelled", "expired"],
  active: ["frozen", "expired", "cancelled", "pending_renewal", "active"],
  frozen: ["active", "expired", "cancelled"],
  expired: ["active", "pending_renewal", "cancelled"],
  cancelled: ["active"],
  pending_renewal: ["active", "expired", "cancelled"],
};

export function assertTransition(from: SubscriptionStatus, to: SubscriptionStatus) {
  if (!ALLOWED[from]?.includes(to)) {
    throw conflict(`Invalid status transition: ${from} → ${to}`);
  }
}

export async function loadSubscription(id: string): Promise<SubscriptionDoc> {
  await connectDB();
  const sub = await Subscription.findById(id);
  if (!sub) throw notFound("Subscription not found");
  return sub;
}

/**
 * Effective status considering time — used during access checks so a missed
 * background job can never grant access incorrectly.
 */
export function effectiveStatus(sub: Pick<SubscriptionDoc, "status" | "startDate" | "endDate" | "frozenUntil">, now = new Date()): SubscriptionStatus {
  if (sub.status === "cancelled") return "cancelled";
  if (sub.status === "pending") return now >= sub.startDate ? "pending" : "pending";
  if (sub.status === "frozen") {
    if (sub.frozenUntil && now > sub.frozenUntil) return "active"; // freeze elapsed
    return "frozen";
  }
  if (sub.status === "active" || sub.status === "pending_renewal") {
    if (now < sub.startDate) return sub.status;
    if (now > sub.endDate) return "expired";
    return sub.status === "pending_renewal" ? "active" : "active";
  }
  if (sub.status === "expired") {
    // reactivate possibility handled by renew flow
    return "expired";
  }
  return sub.status;
}

export interface CreateSubscriptionInput {
  memberId: string;
  branchId: string;
  planId: string;
  startDate: Date;
  trainerId?: string | null;
  discountPercent?: number;
  discountReason?: string;
  source?: "reception" | "online" | "renewal" | "upgrade";
  parentSubscriptionId?: string | null;
  createdBy?: string | null;
  activate?: boolean;
}

export async function createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionDoc> {
  await connectDB();
  const plan = await (await import("@/models/MembershipPlan")).MembershipPlan.findById(input.planId).lean() as unknown as MembershipPlanDoc | null;
  if (!plan || !plan.active || plan.archived) throw badRequest("Plan is not available");

  // Overlap validation: no two overlapping active/pending subs for same member unless renewal after expiry
  const overlapping = await Subscription.findOne({
    member: input.memberId,
    status: { $in: ["pending", "active", "frozen"] },
    endDate: { $gte: input.startDate },
  }).lean();
  if (overlapping) {
    throw conflict("Member already has an active or pending membership covering this period", {
      subscriptionNumber: (overlapping as { subscriptionNumber: string }).subscriptionNumber,
    });
  }

  const endDate = computePlanEndDate(input.startDate, plan.durationUnit, plan.durationValue);
  const discountPercent = Math.min(100, Math.max(0, input.discountPercent ?? 0));
  if (discountPercent > 0 && !plan.discountEligible) throw badRequest("This plan is not eligible for discounts");

  const breakdown = computePrice({
    baseMinor: plan.priceMinor,
    discountPercent,
    taxPercent: plan.taxPercent,
    taxInclusive: plan.taxInclusive,
    joiningFeeMinor: plan.joiningFeeMinor,
  });

  const subNumber = await nextSequence("subscription", "SUB-", 5);
  const activate = input.activate ?? true;

  const sub = await Subscription.create({
    subscriptionNumber: subNumber,
    member: input.memberId,
    branch: input.branchId,
    plan: plan._id,
    planSnapshot: {
      name: plan.name, code: plan.code, durationValue: plan.durationValue, durationUnit: plan.durationUnit,
      priceMinor: plan.priceMinor, taxPercent: plan.taxPercent, taxInclusive: plan.taxInclusive,
      joiningFeeMinor: plan.joiningFeeMinor, freezeAllowed: plan.freezeAllowed, maxFreezes: plan.maxFreezes,
      freezeDaysMax: plan.freezeDaysMax, classAccess: plan.classAccess, accessHours: plan.accessHours ?? null,
    },
    startDate: input.startDate,
    endDate,
    activatedAt: activate ? new Date() : null,
    status: activate ? "active" : "pending",
    trainer: input.trainerId ?? null,
    discountPercent,
    discountReason: input.discountReason ?? "",
    baseMinor: breakdown.baseMinor,
    discountMinor: breakdown.discountMinor,
    taxMinor: breakdown.taxMinor,
    joiningFeeMinor: breakdown.joiningFeeMinor,
    totalMinor: breakdown.totalMinor,
    amountPaidMinor: 0,
    balanceMinor: breakdown.totalMinor,
    paymentStatus: "unpaid",
    source: input.source ?? "reception",
    parentSubscription: input.parentSubscriptionId ?? null,
    createdBy: input.createdBy ?? null,
  });
  return sub;
}

export async function transitionSubscription(
  sub: SubscriptionDoc,
  to: SubscriptionStatus,
  patch: Partial<SubscriptionDoc> = {},
) {
  assertTransition(sub.status, to);
  sub.status = to;
  if (to === "active") {
    if (!sub.activatedAt) sub.activatedAt = new Date();
  }
  if (to === "cancelled") {
    sub.cancelledAt = new Date();
  }
  Object.assign(sub, patch);
  await sub.save();
  return sub;
}

export async function freezeSubscription(sub: SubscriptionDoc, days: number, reason = "") {
  if (!sub.planSnapshot.freezeAllowed) throw badRequest("Freezes are not allowed on this plan");
  if (sub.freezeCount >= sub.planSnapshot.maxFreezes) throw badRequest("Maximum freezes already used");
  if (days <= 0 || days > sub.planSnapshot.freezeDaysMax) {
    throw badRequest(`Freeze must be between 1 and ${sub.planSnapshot.freezeDaysMax} days`);
  }
  if (sub.status !== "active") throw badRequest("Only active memberships can be frozen");
  const now = new Date();
  const newEnd = new Date(sub.endDate.getTime());
  newEnd.setDate(newEnd.getDate() + days);
  sub.freezeCount += 1;
  sub.frozenDaysTotal += days;
  sub.frozenUntil = new Date(now.getTime() + days * 86400000);
  sub.endDate = newEnd;
  sub.notes = [sub.notes, reason].filter(Boolean).join(" | ");
  return transitionSubscription(sub, "frozen");
}

export async function unfreezeSubscription(sub: SubscriptionDoc) {
  if (sub.status !== "frozen") throw badRequest("Subscription is not frozen");
  sub.frozenUntil = null;
  return transitionSubscription(sub, "active");
}

export async function extendSubscription(sub: SubscriptionDoc, days: number, reason: string) {
  if (days <= 0 || days > 365) throw badRequest("Extension must be 1-365 days");
  sub.endDate = new Date(sub.endDate.getTime() + days * 86400000);
  sub.notes = [sub.notes, `Extended +${days}d: ${reason}`].filter(Boolean).join(" | ");
  if (sub.status === "expired") return transitionSubscription(sub, "active");
  await sub.save();
  return sub;
}

export async function cancelSubscription(sub: SubscriptionDoc, reason: string) {
  sub.cancelReason = reason;
  return transitionSubscription(sub, "cancelled");
}

/**
 * Renewal: creates a NEW subscription linked to the parent. Old history is never overwritten.
 */
export async function renewSubscription(
  parent: SubscriptionDoc,
  opts: { startDate: Date; discountPercent?: number; createdBy?: string | null; activate?: boolean },
): Promise<SubscriptionDoc> {
  if (parent.status === "cancelled") throw badRequest("Cancelled memberships cannot be renewed; create a new membership");
  const baseStart = opts.startDate > parent.endDate ? opts.startDate : new Date(parent.endDate.getTime());
  return createSubscription({
    memberId: String(parent.member),
    branchId: String(parent.branch),
    planId: String(parent.plan),
    startDate: baseStart,
    trainerId: parent.trainer ? String(parent.trainer) : null,
    discountPercent: opts.discountPercent ?? parent.discountPercent,
    discountReason: "renewal",
    source: "renewal",
    parentSubscriptionId: String(parent._id),
    createdBy: opts.createdBy ?? null,
    activate: opts.activate ?? true,
  });
}

/** The member's currently effective membership for access checks. */
export async function getActiveMembership(memberId: string, now = new Date()) {
  await connectDB();
  const subs = await Subscription.find({
    member: memberId,
    status: { $in: ["active", "frozen", "pending", "pending_renewal", "expired"] },
  }).sort({ endDate: -1 });
  for (const s of subs) {
    const eff = effectiveStatus(s, now);
    if (eff === "active") return s;
  }
  return null;
}

export function recomputeMoney(sub: SubscriptionDoc) {
  sub.balanceMinor = Math.max(0, sub.totalMinor - sub.amountPaidMinor);
  sub.paymentStatus = sub.amountPaidMinor <= 0 ? "unpaid" : sub.amountPaidMinor >= sub.totalMinor ? "paid" : "partial";
  if (sub.paymentStatus === "paid" && sub.status === "pending") {
    // keep pending until explicitly activated or start date reached; activation handled by caller
  }
  return sub;
}

export function toSubscriptionJSON(s: SubscriptionDoc & { _id: Types.ObjectId }) {
  return {
    id: String(s._id),
    subscriptionNumber: s.subscriptionNumber,
    member: String(s.member),
    branch: String(s.branch),
    plan: String(s.plan),
    planSnapshot: s.planSnapshot,
    startDate: s.startDate,
    endDate: s.endDate,
    activatedAt: s.activatedAt,
    status: s.status,
    effectiveStatus: effectiveStatus(s),
    trainer: s.trainer ? String(s.trainer) : null,
    discountPercent: s.discountPercent,
    baseMinor: s.baseMinor,
    discountMinor: s.discountMinor,
    taxMinor: s.taxMinor,
    joiningFeeMinor: s.joiningFeeMinor,
    totalMinor: s.totalMinor,
    amountPaidMinor: s.amountPaidMinor,
    balanceMinor: s.balanceMinor,
    paymentStatus: s.paymentStatus,
    freezeCount: s.freezeCount,
    frozenUntil: s.frozenUntil,
    source: s.source,
    parentSubscription: s.parentSubscription ? String(s.parentSubscription) : null,
    notes: s.notes,
    createdAt: s.createdAt,
  };
}
