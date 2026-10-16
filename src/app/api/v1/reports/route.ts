import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { withAuth, ok, scopeFor, forbidden } from "@/lib/api";
import { parseDateRange, csvResponse } from "@/lib/utils";
import { requirePermission } from "@/lib/api";
import { Payment, Invoice, Refund } from "@/models/Payment";
import { Subscription } from "@/models/Subscription";
import { MemberProfile } from "@/models/MemberProfile";
import { Attendance } from "@/models/Attendance";
import { Expense } from "@/models/Lead";
import { Lead } from "@/models/Lead";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/time";

/**
 * Reports: /reports?type=revenue|dues|members|attendance|expenses|leads&format=csv
 */
export const GET = withAuth("reports:read", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "revenue";
  const format = url.searchParams.get("format") ?? "json";
  const scope = scopeFor(user);
  const range = parseDateRange(url);
  const from = range.from ?? new Date(Date.now() - 90 * 86400000);
  const to = range.to ?? new Date();

  switch (type) {
    case "revenue": {
      const rows = await Payment.aggregate([
        { $match: { ...scope, status: "success", paidAt: { $gte: from, $lte: to } } },
        { $group: { _id: { method: "$method", day: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } } }, totalMinor: { $sum: "$amountMinor" }, count: { $sum: 1 } } },
        { $sort: { "_id.day": 1 } },
      ]);
      if (format === "csv") {
        return csvResponse(rows.map((r) => ({ day: r._id.day, method: r._id.method, count: r.count, amount: formatMoney(r.totalMinor) })), `revenue-${Date.now()}.csv`);
      }
      const total = rows.reduce((s, r) => s + r.totalMinor, 0);
      return ok({ type, from, to, totalMinor: total, rows });
    }
    case "dues": {
      const rows = await Invoice.find({ ...scope, status: { $in: ["issued", "partial"] }, balanceMinor: { $gt: 0 } })
        .populate("member", "memberNumber firstName lastName phone").sort({ issuedAt: -1 }).limit(2000).lean();
      if (format === "csv") {
        return csvResponse(rows.map((i) => ({
          invoiceNumber: i.invoiceNumber,
          member: `${(i.member as never as { firstName: string; lastName: string })?.firstName ?? ""} ${(i.member as never as { lastName: string })?.lastName ?? ""}`.trim(),
          phone: (i.member as never as { phone?: string })?.phone ?? "",
          total: formatMoney(i.totalMinor), paid: formatMoney(i.paidMinor), balance: formatMoney(i.balanceMinor),
          issuedAt: fmtDate(i.issuedAt),
        })), `dues-${Date.now()}.csv`);
      }
      const totalMinor = rows.reduce((s, r) => s + r.balanceMinor, 0);
      return ok({ type, totalMinor, count: rows.length, rows });
    }
    case "members": {
      const rows = await MemberProfile.aggregate([
        { $match: { ...scope, deletedAt: null, createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: { day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, status: "$status" }, count: { $sum: 1 } } },
        { $sort: { "_id.day": 1 } },
      ]);
      if (format === "csv") return csvResponse(rows.map((r) => ({ day: r._id.day, status: r._id.status, count: r.count })), `members-${Date.now()}.csv`);
      return ok({ type, from, to, rows });
    }
    case "subscriptions": {
      const rows = await Subscription.aggregate([
        { $match: { ...scope, createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: "$status", count: { $sum: 1 }, totalMinor: { $sum: "$totalMinor" }, paidMinor: { $sum: "$amountPaidMinor" } } },
      ]);
      if (format === "csv") return csvResponse(rows.map((r) => ({ status: r._id, count: r.count, billed: formatMoney(r.totalMinor), collected: formatMoney(r.paidMinor) })), `subscriptions-${Date.now()}.csv`);
      return ok({ type, from, to, rows });
    }
    case "attendance": {
      const rows = await Attendance.aggregate([
        { $match: { ...scope, checkInAt: { $gte: from, $lte: to } } },
        { $group: { _id: { day: { $dateToString: { format: "%Y-%m-%d", date: "$checkInAt" } } }, count: { $sum: 1 } } },
        { $sort: { "_id.day": 1 } },
      ]);
      if (format === "csv") return csvResponse(rows.map((r) => ({ day: r._id.day, checkins: r.count })), `attendance-${Date.now()}.csv`);
      return ok({ type, from, to, rows });
    }
    case "expenses": {
      const rows = await Expense.aggregate([
        { $match: { ...scope, date: { $gte: from, $lte: to }, status: { $in: ["approved", "paid"] } } },
        { $group: { _id: { day: { $dateToString: { format: "%Y-%m-%d", date: "$date" } } }, totalMinor: { $sum: "$amountMinor" }, count: { $sum: 1 } } },
        { $sort: { "_id.day": 1 } },
      ]);
      if (format === "csv") return csvResponse(rows.map((r) => ({ day: r._id.day, count: r.count, amount: formatMoney(r.totalMinor) })), `expenses-${Date.now()}.csv`);
      return ok({ type, from, to, rows });
    }
    case "leads": {
      const rows = await Lead.aggregate([
        { $match: { ...scope, createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]);
      const converted = rows.find((r) => r._id === "converted")?.count ?? 0;
      const total = rows.reduce((s, r) => s + r.count, 0);
      if (format === "csv") return csvResponse(rows.map((r) => ({ status: r._id, count: r.count })), `leads-${Date.now()}.csv`);
      return ok({ type, from, to, rows, conversionRatePct: total ? Math.round((converted / total) * 100) : 0 });
    }
    case "refunds": {
      const rows = await Refund.find({ ...scope, createdAt: { $gte: from, $lte: to } }).populate("member", "memberNumber firstName lastName").lean();
      if (format === "csv") return csvResponse(rows.map((r) => ({ refundNumber: r.refundNumber, amount: formatMoney(r.amountMinor), status: r.status, reason: r.reason, at: fmtDate(r.createdAt) })), `refunds-${Date.now()}.csv`);
      const totalMinor = rows.reduce((s, r) => s + r.amountMinor, 0);
      return ok({ type, from, to, totalMinor, rows });
    }
    default:
      return ok({ error: `Unknown report type ${type}` }, { status: 400 });
  }
});

void forbidden;
