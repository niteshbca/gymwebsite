import { NextRequest } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { ClassModel, ClassBooking } from "@/models/Class";
import { withAuth, ok, okPage, notFound, badRequest, audit } from "@/lib/api";
import { getActiveMembership } from "@/server/services/subscription";
import { startOfDay } from "date-fns";
import { sendMail, emailTemplates } from "@/lib/mailer";
import { getSettings } from "@/models/GymSettings";
import { MemberProfile } from "@/models/MemberProfile";
import { fmtDateTime } from "@/lib/time";

type Ctx = { params: Promise<{ id: string }> };

/** Book a seat for a specific occurrence date (YYYY-MM-DD). Prevents overbooking. */
export const POST = withAuth("classes:book", async (req: NextRequest, ctx: Ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) throw notFound("Class not found");
  const cls = await ClassModel.findById(id);
  if (!cls || !cls.active) throw notFound("Class not found");

  const body = z.object({ occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), memberId: z.string().optional() }).parse(await req.json());

  let memberId = body.memberId;
  if (user.role === "member") {
    if (!user.memberProfile) throw badRequest("No member profile");
    memberId = user.memberProfile;
  }
  if (!memberId) throw badRequest("memberId required");
  if (user.role !== "member" && user.role !== "super_admin" && user.role !== "gym_owner" && user.role !== "branch_manager" && user.role !== "receptionist") {
    throw badRequest("Not allowed to book on behalf of members");
  }

  // Eligibility: member must have an active membership with class access
  const membership = await getActiveMembership(memberId);
  if (cls.requiresPlanAccess) {
    if (!membership) throw badRequest("Member has no active membership");
    if (membership.planSnapshot.classAccess === "none") throw badRequest("This plan does not include group classes");
  }

  const occurrence = startOfDay(new Date(body.occurrenceDate + "T00:00:00"));
  const existing = await ClassBooking.findOne({ class: cls._id, occurrenceDate: occurrence, member: memberId, status: { $ne: "cancelled" } });
  if (existing) throw badRequest("Already booked for this session");

  // Conflicting booking (same time slot)
  const conflict = await ClassBooking.findOne({
    member: memberId,
    status: "booked",
    occurrenceDate: occurrence,
    class: { $ne: cls._id },
  }).populate<{ class: { startTime: string; endTime: string } }>("class", "startTime endTime");
  if (conflict?.class && overlaps(conflict.class.startTime, conflict.class.endTime, cls.startTime, cls.endTime)) {
    throw badRequest(`Conflicts with another class (${conflict.class.startTime}–${conflict.class.endTime})`);
  }

  const bookedCount = await ClassBooking.countDocuments({ class: cls._id, occurrenceDate: occurrence, status: "booked" });
  let status: "booked" | "waitlisted" = "booked";
  if (bookedCount >= cls.capacity) {
    const waitlisted = await ClassBooking.countDocuments({ class: cls._id, occurrenceDate: occurrence, status: "waitlisted" });
    if (waitlisted >= cls.waitlistCapacity) throw badRequest("Class and waitlist are full");
    status = "waitlisted";
  }

  const booking = await ClassBooking.create({
    class: cls._id,
    occurrenceDate: occurrence,
    member: memberId,
    status,
    source: user.role === "member" ? "member" : "reception",
    passCode: `FP-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    bookedAt: new Date(),
  });

  const member = await MemberProfile.findById(memberId).lean();
  if (member?.email) {
    const when = fmtDateTime(new Date(body.occurrenceDate + "T" + cls.startTime + ":00"));
    const settings = await getSettings();
    const tpl =
      status === "waitlisted"
        ? emailTemplates.classBookingRejected(`${member.firstName} ${member.lastName}`.trim(), cls.name, when, "The class is full — you are on the waitlist and our team will call you if a seat opens.")
        : emailTemplates.classBookingApproved({
            name: `${member.firstName} ${member.lastName}`.trim(),
            className: cls.name,
            when,
            room: cls.room,
            passCode: booking.passCode,
            gymName: settings.gymName,
            address: settings.address,
            city: settings.city,
            phone: settings.phone,
          });
    await sendMail({ to: member.email, subject: tpl.subject, html: tpl.html, template: status === "waitlisted" ? "class_booking_waitlist" : "class_booking_approved", entityId: String(booking._id) });
  }

  await audit(user, "class.book", "ClassBooking", String(booking._id), { classId: id, status });
  return new Response(JSON.stringify({ success: true, data: { id: String(booking._id), status } }), { status: 201 });
});

export const GET = withAuth("classes:book", async (req: NextRequest, ctx: Ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const filter: Record<string, unknown> = { class: id, status: { $in: ["booked", "waitlisted", "attended"] } };
  if (date) filter.occurrenceDate = startOfDay(new Date(date + "T00:00:00"));
  let memberFilter: Record<string, unknown> = {};
  if (user.role === "member" && user.memberProfile) memberFilter = { member: user.memberProfile };
  const bookings = await ClassBooking.find({ ...filter, ...memberFilter })
    .populate("member", "memberNumber firstName lastName phone")
    .sort({ occurrenceDate: -1 })
    .limit(200)
    .lean();
  return okPage(bookings.map((b) => ({ ...b, id: String(b._id) })), bookings.length, 1, 200);
});

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return toMin(aStart) < toMin(bEnd) && toMin(bStart) < toMin(aEnd);
}
function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
