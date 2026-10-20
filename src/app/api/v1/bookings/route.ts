import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { ClassBooking } from "@/models/Class";
import { withAuth, okPage, scopeFor } from "@/lib/api";
import { startOfDay, endOfDay } from "date-fns";

/**
 * Admin/front-desk booking inbox.
 * GET /api/v1/bookings?status=pending&q=email&page=1
 * Shows website booking requests so staff can approve or reject them.
 */
export const GET = withAuth("classes:read", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q")?.trim();
  const classId = url.searchParams.get("classId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 25)));

  const filter: Record<string, unknown> = {};
  if (status && status !== "all") filter.status = status;
  if (from || to) {
    filter.occurrenceDate = {};
    if (from) (filter.occurrenceDate as Record<string, unknown>).$gte = startOfDay(new Date(from));
    if (to) (filter.occurrenceDate as Record<string, unknown>).$lte = endOfDay(new Date(to));
  }
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ guestName: rx }, { guestEmail: rx }, { guestPhone: rx }, { passCode: rx }];
  }

  // Branch-scoped staff only see bookings for classes at their branch
  const scope = scopeFor(user);
  const classFilter: Record<string, unknown> = {};
  if (classId) classFilter._id = classId;
  if (scope.branch) classFilter.branch = scope.branch;
  if (Object.keys(classFilter).length > 0) {
    const { ClassModel } = await import("@/models/Class");
    filter.class = { $in: await ClassModel.find(classFilter).distinct("_id") };
  }

  const [items, total] = await Promise.all([
    ClassBooking.find(filter)
      .sort({ status: 1, occurrenceDate: -1, createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate("class", "name startTime endTime room capacity image branch")
      .populate("member", "memberNumber firstName lastName phone email")
      .lean(),
    ClassBooking.countDocuments(filter),
  ]);

  return okPage(
    items.map((b: any) => ({
      id: String(b._id),
      status: b.status,
      source: b.source,
      passCode: b.passCode,
      guestName: b.guestName || (b.member ? `${b.member.firstName} ${b.member.lastName}`.trim() : "—"),
      guestEmail: b.guestEmail || b.member?.email || "",
      guestPhone: b.guestPhone || b.member?.phone || "",
      notes: b.notes,
      rejectReason: b.rejectReason,
      occurrenceDate: b.occurrenceDate,
      bookedAt: b.bookedAt,
      reviewedAt: b.reviewedAt,
      className: b.class?.name ?? "—",
      startTime: b.class?.startTime ?? "",
      endTime: b.class?.endTime ?? "",
      room: b.class?.room ?? "",
      classId: b.class ? String((b.class as any)._id) : "",
      memberNumber: b.member?.memberNumber ?? "",
    })),
    total,
    page,
    pageSize,
  );
});
