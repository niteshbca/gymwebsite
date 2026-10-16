import { connectDB } from "@/lib/db";
import { Attendance } from "@/models/Attendance";
import { MemberProfile } from "@/models/MemberProfile";
import { Subscription } from "@/models/Subscription";
import { getActiveMembership, effectiveStatus } from "./subscription";
import { badRequest, notFound } from "@/lib/api";
import { isWithinInterval } from "date-fns";

export interface AccessResult {
  allowed: boolean;
  reason: string;
}

/** Full membership validation for physical access. */
export async function validateAccess(
  memberId: string,
  opts: { branchId?: string | null; now?: Date; allowHoursCheck?: boolean } = {},
): Promise<AccessResult> {
  await connectDB();
  const now = opts.now ?? new Date();
  const member = await MemberProfile.findById(memberId);
  if (!member) return { allowed: false, reason: "Member not found" };
  if (member.status === "blocked") return { allowed: false, reason: "Member is blocked" };

  const sub = await getActiveMembership(memberId, now);
  if (!sub) {
    const anySub = await Subscription.findOne({ member: memberId }).sort({ endDate: -1 });
    if (!anySub) return { allowed: false, reason: "No membership on file" };
    const eff = effectiveStatus(anySub, now);
    if (eff === "expired") return { allowed: false, reason: "Membership expired" };
    if (eff === "cancelled") return { allowed: false, reason: "Membership cancelled" };
    if (eff === "frozen") return { allowed: false, reason: "Membership is frozen" };
    return { allowed: false, reason: `Membership is ${eff}` };
  }

  // Branch access
  if (opts.branchId && sub.planSnapshot) {
    const plan = await (await import("@/models/MembershipPlan")).MembershipPlan.findById(sub.plan).lean();
    if (plan && plan.branchAccess === "home" && String(sub.branch) !== String(opts.branchId)) {
      return { allowed: false, reason: "Plan is valid only at the home branch" };
    }
  }

  // Access hours window (e.g. 06:00–14:00 for off-peak plans)
  if (opts.allowHoursCheck !== false && sub.planSnapshot?.accessHours) {
    const { from, to } = sub.planSnapshot.accessHours;
    const [fh, fm] = from.split(":").map(Number);
    const [th, tm] = to.split(":").map(Number);
    const start = new Date(now); start.setHours(fh, fm, 0, 0);
    const end = new Date(now); end.setHours(th, tm, 59, 999);
    if (end < start) {
      // wraps midnight
      const inWindow = isWithinInterval(now, { start, end: new Date(end.getTime() + 86400000) }) || now < end;
      if (!inWindow) return { allowed: false, reason: `Access hours are ${from}–${to}` };
    } else if (!isWithinInterval(now, { start, end })) {
      return { allowed: false, reason: `Access hours are ${from}–${to}` };
    }
  }

  return { allowed: true, reason: "OK" };
}

/** Prevent duplicate accidental check-ins; define re-entry: checkout first. */
export async function checkIn(opts: {
  memberId: string;
  branchId: string;
  method: "qr" | "member_id" | "manual" | "reception";
  verifiedBy?: string | null;
  now?: Date;
}) {
  await connectDB();
  const now = opts.now ?? new Date();
  const access = await validateAccess(opts.memberId, { branchId: opts.branchId, now });
  if (!access.allowed) throw badRequest(access.reason);

  // Duplicate guard: open session without checkout
  const open = await Attendance.findOne({
    member: opts.memberId,
    checkOutAt: null,
    checkInAt: { $gte: new Date(now.getTime() - 8 * 3600000) },
  });
  if (open) throw badRequest("Member already has an open check-in. Please check out first.");

  // Re-entry rule: within 15 minutes treat as duplicate
  const recent = await Attendance.findOne({
    member: opts.memberId,
    checkInAt: { $gte: new Date(now.getTime() - 15 * 60000) },
  });
  if (recent) throw badRequest("Duplicate check-in ignored (checked in within 15 minutes)");

  const record = await Attendance.create({
    member: opts.memberId,
    branch: opts.branchId,
    checkInAt: now,
    method: opts.method,
    verifiedBy: opts.verifiedBy ?? null,
  });
  return record;
}

export async function checkOut(memberId: string, now = new Date()) {
  await connectDB();
  const open = await Attendance.findOne({ member: memberId, checkOutAt: null }).sort({ checkInAt: -1 });
  if (!open) throw notFound("No open check-in found");
  if (now.getTime() - open.checkInAt.getTime() < 60_000) {
    // allow, but keep sane
  }
  open.checkOutAt = now;
  await open.save();
  return open;
}
