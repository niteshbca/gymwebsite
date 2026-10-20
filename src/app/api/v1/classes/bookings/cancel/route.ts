import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { ClassBooking, ClassModel } from "@/models/Class";
import { withAuth, ok, notFound, badRequest, audit } from "@/lib/api";
import { getActiveMembership } from "@/server/services/subscription";

/** Cancel a booking; promote first waitlisted member if a seat frees up. */
export const POST = withAuth("classes:book", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const body = z.object({ bookingId: z.string().min(1) }).parse(await req.json());
  const booking = await ClassBooking.findById(body.bookingId);
  if (!booking) throw notFound("Booking not found");
  if (user.role === "member" && user.memberProfile !== String(booking.member)) throw badRequest("Members can only cancel their own bookings");

  const cls = await ClassModel.findById(booking.class);
  if (cls) {
    const cutoffMs = cls.cancelCutoffHours * 3600000;
    const occurrenceStart = new Date(booking.occurrenceDate);
    const [h, m] = cls.startTime.split(":").map(Number);
    occurrenceStart.setHours(h, m, 0, 0);
    if (Date.now() + cutoffMs > occurrenceStart.getTime() && user.role === "member") {
      throw badRequest(`Cancellations close ${cls.cancelCutoffHours}h before the class`);
    }
  }

  if (booking.status === "booked" && cls) {
    const waitlisted = await ClassBooking.findOne({ class: cls._id, occurrenceDate: booking.occurrenceDate, status: "waitlisted" }).sort({ bookedAt: 1 });
    if (waitlisted) {
      waitlisted.status = "booked";
      await waitlisted.save();
    }
  }
  booking.status = "cancelled";
  booking.cancelledAt = new Date();
  await booking.save();
  await audit(user, "class.cancel_booking", "ClassBooking", String(booking._id));
  void getActiveMembership;
  return ok({ cancelled: true, id: String(booking._id) });
}, { allowSelfMember: true });
