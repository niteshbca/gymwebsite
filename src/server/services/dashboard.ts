import { connectDB } from "@/lib/db";
import { MemberProfile } from "@/models/MemberProfile";
import { Subscription } from "@/models/Subscription";
import { Payment } from "@/models/Payment";
import { Invoice } from "@/models/Payment";
import { Attendance } from "@/models/Attendance";
import { Lead } from "@/models/Lead";
import { Expense } from "@/models/Lead";
import { ClassModel, ClassBooking } from "@/models/Class";
import { startOfMonth, subMonths, startOfDay, endOfDay, subDays } from "date-fns";

/** All dashboard figures come from real database aggregations — no hardcoded data. */
export async function buildDashboard(scope: Record<string, unknown>, now = new Date()) {
  await connectDB();
  const monthStart = startOfMonth(now);
  const prevMonthStart = startOfMonth(subMonths(now, 1));
  const todayStart = startOfDay(now);

  const [
    totalMembers,
    activeMembers,
    expiredMembers,
    expiringSoon,
    todayCheckIns,
    newThisMonth,
    newLastMonth,
    revenueAgg,
    prevRevenueAgg,
    duesAgg,
    enquiriesThisMonth,
    expensesThisMonth,
    activeSubs,
    pendingRegs,
  ] = await Promise.all([
    MemberProfile.countDocuments({ ...scope, deletedAt: null }),
    Subscription.countDocuments({ ...scope, status: "active", endDate: { $gte: now } }),
    Subscription.countDocuments({ ...scope, status: "expired" }),
    Subscription.countDocuments({
      ...scope,
      status: { $in: ["active", "pending_renewal"] },
      endDate: { $gte: now, $lte: subDays(now, -7) },
    }),
    Attendance.countDocuments({ ...scope, checkInAt: { $gte: todayStart } }),
    MemberProfile.countDocuments({ ...scope, deletedAt: null, createdAt: { $gte: monthStart } }),
    MemberProfile.countDocuments({ ...scope, deletedAt: null, createdAt: { $gte: prevMonthStart, $lt: monthStart } }),
    Payment.aggregate([
      { $match: { ...scope, status: "success", paidAt: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: "$amountMinor" }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { ...scope, status: "success", paidAt: { $gte: prevMonthStart, $lt: monthStart } } },
      { $group: { _id: null, total: { $sum: "$amountMinor" } } },
    ]),
    Invoice.aggregate([
      { $match: { ...scope, status: { $in: ["issued", "partial"] } } },
      { $group: { _id: null, total: { $sum: "$balanceMinor" } } },
    ]),
    Lead.countDocuments({ ...scope, createdAt: { $gte: monthStart } }),
    Expense.aggregate([
      { $match: { ...scope, status: { $in: ["approved", "paid"] }, date: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: "$amountMinor" } } },
    ]),
    Subscription.aggregate([
      { $match: { ...scope, status: "active", endDate: { $gte: now } } },
      { $group: { _id: "$planSnapshot.name", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),
    MemberProfile.countDocuments({ ...scope, status: "active", user: null }),
  ]);

  // 6-month revenue trend
  const months: { label: string; start: Date; end: Date }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(now, i);
    months.push({ label: d.toLocaleString("en", { month: "short" }), start: startOfMonth(d), end: endOfMonthSafe(d) });
  }
  const trend = await Promise.all(
    months.map(async (m) => {
      const r = await Payment.aggregate([
        { $match: { ...scope, status: "success", paidAt: { $gte: m.start, $lte: m.end } } },
        { $group: { _id: null, total: { $sum: "$amountMinor" } } },
      ]);
      return { month: m.label, revenueMinor: r[0]?.total ?? 0 };
    }),
  );

  // New members per month (6 months)
  const memberTrend = await Promise.all(
    months.map(async (m) => {
      const c = await MemberProfile.countDocuments({ ...scope, deletedAt: null, createdAt: { $gte: m.start, $lte: m.end } });
      return { month: m.label, count: c };
    }),
  );

  // Class occupancy
  const todayDow = now.getDay();
  const todayClasses = await ClassModel.find({ ...scope, active: true, dayOfWeek: todayDow }).lean();
  const occupancy = await Promise.all(
    todayClasses.map(async (c) => {
      const booked = await ClassBooking.countDocuments({
        class: c._id,
        occurrenceDate: { $gte: todayStart, $lte: endOfDay(now) },
        status: { $in: ["booked", "attended"] },
      });
      return { name: c.name, booked, capacity: c.capacity };
    }),
  );

  // Check-ins last 14 days
  const checkinTrend: { day: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = subDays(now, i);
    const s = startOfDay(d);
    const e = endOfDay(d);
    const count = await Attendance.countDocuments({ ...scope, checkInAt: { $gte: s, $lte: e } });
    checkinTrend.push({ day: s.toLocaleDateString("en", { day: "2-digit", month: "short" }), count });
  }

  const monthRevenue = revenueAgg[0]?.total ?? 0;
  const lastMonthRevenue = prevRevenueAgg[0]?.total ?? 0;
  const growthPct = lastMonthRevenue > 0 ? Math.round(((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : monthRevenue > 0 ? 100 : 0;

  return {
    cards: {
      totalMembers,
      activeMembers,
      expiredMembers,
      expiringSoon,
      todayCheckIns,
      newRegistrations: newThisMonth,
      newRegistrationsPrev: newLastMonth,
      monthlyRevenueMinor: monthRevenue,
      monthlyRevenueGrowthPct: growthPct,
      outstandingDuesMinor: duesAgg[0]?.total ?? 0,
      enquiries: enquiriesThisMonth,
      expensesMinor: (expensesThisMonth as any)[0]?.total ?? 0,
      pendingRegistrations: pendingRegs,
      renewalsThisMonth: await Subscription.countDocuments({ ...scope, source: "renewal", createdAt: { $gte: monthStart } }),
      paymentsThisMonth: revenueAgg[0]?.count ?? 0,
    },
    revenueTrend: trend,
    memberTrend,
    planDistribution: activeSubs.map((s) => ({ name: s._id as string, count: s.count as number })),
    classOccupancy: occupancy,
    checkinTrend,
  };
}

function endOfMonthSafe(d: Date) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999);
  return x;
}
