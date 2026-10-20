import { NextRequest } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { ClassModel, ClassBooking } from "@/models/Class";
import { withPublic, ok, badRequest, notFound } from "@/lib/api";
import { sendMail, emailTemplates } from "@/lib/mailer";
import { getSettings } from "@/models/GymSettings";
import { fmtDateTime } from "@/lib/time";
import { randomToken } from "@/lib/crypto";
import { startOfDay } from "date-fns";

const schema = z.object({
  classId: z.string().min(1),
  occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(2).max(80),
  email: z.string().email(),
  phone: z.string().trim().min(8).max(15),
  notes: z.string().max(500).default(""),
});

/** In-memory rate limit per IP (demo-grade abuse protection). */
const bucket = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, max = 8, windowMs = 10 * 60_000) {
  const now = Date.now();
  const rec = bucket.get(key);
  if (!rec || rec.resetAt < now) bucket.set(key, { count: 1, resetAt: now + windowMs });
  else if (++rec.count > max) throw badRequest("Too many booking requests. Please try again later.");
}

/** Short human-friendly pass code shown on the digital pass, e.g. FP-7K3M-9QZ2 */
function newPassCode() {
  const raw = randomToken(8).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const a = raw.slice(0, 4) || "FP00";
  const b = raw.slice(4, 8) || "0000";
  return `FP-${a}-${b}`;
}

/**
 * Public class booking request (no login needed).
 * Creates a "pending" booking that a gym staff member must approve from
 * /admin/bookings. On approval the customer receives their digital pass by email.
 */
export const POST = withPublic(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  rateLimit(ip);

  const body = schema.parse(await req.json());
  await connectDB();

  if (!Types.ObjectId.isValid(body.classId)) throw notFound("Class not found");
  const cls = await ClassModel.findById(body.classId).populate("trainer", "name");
  if (!cls || !cls.active) throw notFound("Class not found");

  const occurrence = startOfDay(new Date(body.occurrenceDate + "T00:00:00"));
  if (Number.isNaN(occurrence.getTime())) throw badRequest("Invalid date");
  const sessionStart = new Date(`${body.occurrenceDate}T${cls.startTime}:00`);
  if (sessionStart.getTime() < Date.now()) throw badRequest("That session has already started. Please pick an upcoming date.");

  // Same email already holds a seat for this session
  const email = body.email.toLowerCase().trim();
  const existing = await ClassBooking.findOne({
    class: cls._id,
    occurrenceDate: occurrence,
    guestEmail: email,
    status: { $nin: ["cancelled", "rejected"] },
  });
  if (existing) throw badRequest("You already have a booking for this session. Our team will contact you if needed.");

  // Capacity check (pending requests count so we never oversell)
  const taken = await ClassBooking.countDocuments({
    class: cls._id,
    occurrenceDate: occurrence,
    status: { $in: ["pending", "booked", "waitlisted", "attended"] },
  });
  if (taken >= cls.capacity + cls.waitlistCapacity) throw badRequest("This session is fully booked. Please pick another slot.");

  const booking = await ClassBooking.create({
    class: cls._id,
    occurrenceDate: occurrence,
    member: null,
    status: "pending",
    source: "website",
    guestName: body.name.trim(),
    guestEmail: email,
    guestPhone: body.phone.trim(),
    notes: body.notes.trim(),
    passCode: newPassCode(),
    bookedAt: new Date(),
  });

  const when = fmtDateTime(sessionStart);
  if (body.email) {
    const tpl = emailTemplates.classBookingPending(body.name, cls.name, when);
    await sendMail({ to: email, subject: tpl.subject, html: tpl.html, template: "class_booking_pending", entityId: String(booking._id) });
  }
  const settings = await getSettings();

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        id: String(booking._id),
        status: "pending",
        className: cls.name,
        when,
        gymName: settings.gymName,
        phone: settings.phone,
        message: "Booking request received! You will get an email with your digital pass once the gym confirms it.",
      },
    }),
    { status: 201 },
  );
});
