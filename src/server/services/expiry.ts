import { connectDB } from "@/lib/db";
import { Subscription } from "@/models/Subscription";
import { MemberProfile } from "@/models/MemberProfile";
import { ReminderLog } from "@/models/System";
import { sendMail, emailTemplates } from "@/lib/mailer";
import { daysUntil, fmtDate } from "@/lib/time";
import { startOfDay } from "date-fns";

/**
 * Transition overdue subscriptions to expired. Idempotent: only touches
 * status=active/frozen with endDate < now. Safe to run on every tick and
 * across multiple workers (findOneAndUpdate is atomic per document).
 */
export async function expireOverdueSubscriptions(now = new Date()) {
  const result = await Subscription.updateMany(
    { status: { $in: ["active", "frozen"] }, endDate: { $lt: now } },
    { $set: { status: "expired" } },
  );
  return { modified: result.modifiedCount };
}

/**
 * Send expiry reminders with per-day dedupe (ReminderLog unique key).
 * Never reports success when SMTP fails — emailStatus records the truth.
 */
export async function sendExpiryReminders(now = new Date(), windows = [7, 3, 1]) {
  const stats = { sent: 0, failed: 0, skipped: 0, duplicates: 0 };
  for (const windowDays of windows) {
    const dayStart = startOfDay(now);
    const windowStart = new Date(dayStart.getTime() + windowDays * 86400000);
    const windowEnd = new Date(windowStart.getTime() + 86400000 - 1);

    const subs = await Subscription.find({
      status: { $in: ["active", "pending_renewal"] },
      endDate: { $gte: windowStart, $lte: windowEnd },
    }).limit(500);

    for (const sub of subs) {
      const key = `${String(sub._id)}:${windowDays}:${dayStart.toISOString().slice(0, 10)}`;
      const already = await ReminderLog.findOne({ key }).lean();
      if (already) {
        stats.duplicates++;
        continue;
      }
      const member = await MemberProfile.findById(sub.member).lean();
      if (!member?.email) {
        await ReminderLog.create({
          key, subscription: sub._id, member: sub.member, windowDays,
          emailStatus: "skipped_optout", emailError: "member has no email",
        });
        stats.skipped++;
        continue;
      }
      const name = `${member.firstName} ${member.lastName}`.trim();
      const days = daysUntil(sub.endDate, now);
      const tpl = emailTemplates.expiryReminder(name, sub.planSnapshot.name, fmtDate(sub.endDate), days);
      const res = await sendMail({
        to: member.email, subject: tpl.subject, html: tpl.html, template: "expiry_reminder", entityId: String(sub._id),
      });
      const emailStatus = res.ok ? "sent" : "skipped" in res ? "skipped_no_smtp" : "failed";
      await ReminderLog.create({
        key, subscription: sub._id, member: sub.member, windowDays,
        emailStatus, emailError: res.ok ? null : ("skipped" in res ? (res as { reason: string }).reason : (res as { error: string }).error),
      });
      if (res.ok) stats.sent++;
      else if ("skipped" in res) stats.skipped++;
      else stats.failed++;
    }
  }
  return stats;
}

export async function expiryDashboard(now = new Date()) {
  await connectDB();
  const windows = [7, 3, 1];
  const buckets: Record<string, unknown> = {};
  for (const d of windows) {
    const start = new Date(startOfDay(now).getTime() + d * 86400000);
    const end = new Date(start.getTime() + 86400000 - 1);
    buckets[`in_${d}_days`] = await Subscription.countDocuments({
      status: { $in: ["active", "pending_renewal"] }, endDate: { $gte: start, $lte: end },
    });
  }
  buckets.expired = await Subscription.countDocuments({ status: "expired" });
  buckets.unpaid = await Subscription.countDocuments({ paymentStatus: { $in: ["unpaid", "partial"] }, status: { $in: ["active", "pending", "pending_renewal"] } });

  const upcoming = await Subscription.find({
    status: { $in: ["active", "pending_renewal"] },
    endDate: { $gte: startOfDay(now) },
  })
    .sort({ endDate: 1 })
    .limit(50)
    .populate("member", "memberNumber firstName lastName phone email")
    .populate("plan", "name")
    .lean();

  const expired = await Subscription.find({ status: "expired" })
    .sort({ endDate: -1 })
    .limit(50)
    .populate("member", "memberNumber firstName lastName phone email")
    .populate("plan", "name")
    .lean();

  return {
    counts: {
      in7: buckets.in_7_days,
      in3: buckets.in_3_days,
      in1: buckets.in_1_days,
      expired: buckets.expired,
      unpaid: buckets.unpaid,
    },
    upcoming: upcoming.map((s) => ({
      id: String(s._id),
      subscriptionNumber: s.subscriptionNumber,
      member: s.member,
      plan: s.plan,
      endDate: s.endDate,
      daysLeft: daysUntil(s.endDate, now),
      paymentStatus: s.paymentStatus,
      balanceMinor: s.balanceMinor,
    })),
    expired: expired.map((s) => ({
      id: String(s._id),
      subscriptionNumber: s.subscriptionNumber,
      member: s.member,
      plan: s.plan,
      endDate: s.endDate,
      daysAgo: Math.abs(daysUntil(s.endDate, now)),
    })),
  };
}
