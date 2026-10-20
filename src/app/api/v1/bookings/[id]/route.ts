import { NextRequest } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { ClassModel, ClassBooking } from "@/models/Class";
import { withAuth, ok, notFound, badRequest, audit } from "@/lib/api";
import { sendMail, emailTemplates } from "@/lib/mailer";
import { getSettings } from "@/models/GymSettings";
import { fmtDateTime } from "@/lib/time";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(300).default(""),
});

/**
 * Admin approval for website booking requests.
 * PATCH /api/v1/bookings/:id { action: "approve" | "reject", reason? }
 * Approve -> seat confirmed + digital pass emailed to the customer.
 * Reject  -> customer notified with the reason.
 */
export const PATCH = withAuth("classes:book", async (req: NextRequest, ctx: Ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) throw notFound("Booking not found");

  const booking = await ClassBooking.findById(id).populate("class");
  if (!booking) throw notFound("Booking not found");
  if (booking.status === "rejected" || booking.status === "cancelled") throw badRequest(`Booking is already ${booking.status}`);
  if (booking.status !== "pending" && booking.status !== "waitlisted" && booking.status !== "booked") {
    throw badRequest(`Cannot review a booking with status "${booking.status}"`);
  }

  const body = schema.parse(await req.json());
  const cls = booking.class as unknown as InstanceType<typeof ClassModel>;
  if (!cls) throw notFound("Class not found");

  const od = booking.occurrenceDate;
  const dateStr = `${od.getFullYear()}-${String(od.getMonth() + 1).padStart(2, "0")}-${String(od.getDate()).padStart(2, "0")}`;
  const when = fmtDateTime(new Date(`${dateStr}T${cls.startTime}:00`));
  const recipient = booking.guestEmail || "";
  const displayName = booking.guestName || "Member";

  if (body.action === "approve") {
    const bookedCount = await ClassBooking.countDocuments({
      class: cls._id,
      occurrenceDate: booking.occurrenceDate,
      status: { $in: ["booked", "attended"] },
      _id: { $ne: booking._id },
    });
    const full = bookedCount >= cls.capacity;
    booking.status = full ? "waitlisted" : "booked";

    const settings = await getSettings();
    booking.reviewedBy = new Types.ObjectId(user.id);
    booking.reviewedAt = new Date();
    booking.rejectReason = "";
    await booking.save();

    if (recipient) {
      const tpl = full
        ? {
            subject: `Waitlisted: ${cls.name}`,
            html: emailTemplates.classBookingRejected(displayName, cls.name, when, "The session is full — you have been added to the waitlist and our team will call you if a seat opens up.").html,
          }
        : emailTemplates.classBookingApproved({
            name: displayName,
            className: cls.name,
            when,
            room: cls.room,
            passCode: booking.passCode,
            gymName: settings.gymName,
            address: settings.address,
            city: settings.city,
            phone: settings.phone,
          });
      await sendMail({ to: recipient, subject: tpl.subject, html: tpl.html, template: full ? "class_booking_waitlist" : "class_booking_approved", entityId: String(booking._id) });
    }

    await audit(user, "class.booking.approve", "ClassBooking", String(booking._id), { classId: String(cls._id), status: booking.status, full });
    return ok({ id: String(booking._id), status: booking.status, passCode: booking.passCode });
  }

  // reject
  booking.status = "rejected";
  booking.rejectReason = body.reason.trim() || "Rejected by gym staff";
  booking.reviewedBy = new Types.ObjectId(user.id);
  booking.reviewedAt = new Date();
  await booking.save();

  if (recipient) {
    const tpl = emailTemplates.classBookingRejected(displayName, cls.name, when, booking.rejectReason);
    await sendMail({ to: recipient, subject: tpl.subject, html: tpl.html, template: "class_booking_rejected", entityId: String(booking._id) });
  }

  await audit(user, "class.booking.reject", "ClassBooking", String(booking._id), { classId: String(cls._id), reason: booking.rejectReason });
  return ok({ id: String(booking._id), status: booking.status });
});
