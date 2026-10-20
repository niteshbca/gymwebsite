import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { ClassBooking } from "@/models/Class";
import { withAuth, okPage, badRequest } from "@/lib/api";
import { parsePaging } from "@/lib/utils";
import { startOfDay } from "date-fns";

/**
 * The signed-in member's own class bookings.
 * ?view=upcoming (default) | past | all
 */
export const GET = withAuth(null, async (req: NextRequest, _ctx, user) => {
  await connectDB();
  if (!user.memberProfile) throw badRequest("No member profile linked to this account");
  const { page, size, skip, limit } = parsePaging(new URL(req.url));
  const view = new URL(req.url).searchParams.get("view") ?? "upcoming";
  const today = startOfDay(new Date());

  const filter: Record<string, unknown> = { member: user.memberProfile };
  if (view === "upcoming") {
    filter.occurrenceDate = { $gte: today };
    filter.status = { $in: ["booked", "waitlisted"] };
  } else if (view === "past") {
    filter.$or = [
      { occurrenceDate: { $lt: today } },
      { status: { $in: ["cancelled", "rejected", "attended", "no_show"] } },
    ];
  }

  const sort = view === "past" ? { occurrenceDate: -1 } : { occurrenceDate: 1 };
  const [items, total] = await Promise.all([
    ClassBooking.find(filter)
      .sort(sort as Record<string, 1 | -1>)
      .skip(skip)
      .limit(limit)
      .populate("class", "name startTime endTime room capacity trainer image")
      .populate("class.trainer", "name")
      .lean(),
    ClassBooking.countDocuments(filter),
  ]);

  return okPage(
    items.map((b) => {
      const cls = b.class as unknown as {
        _id: unknown;
        name: string;
        startTime: string;
        endTime: string;
        room: string;
        capacity: number;
        image?: string;
        trainer?: { _id: unknown; name: string } | null;
      } | null;
      return {
        id: String(b._id),
        status: b.status,
        occurrenceDate: b.occurrenceDate,
        bookedAt: b.bookedAt,
        passCode: b.passCode,
        rejectReason: b.rejectReason ?? "",
        class: cls
          ? {
              id: String(cls._id),
              name: cls.name,
              startTime: cls.startTime,
              endTime: cls.endTime,
              room: cls.room,
              capacity: cls.capacity,
              image: cls.image ?? "",
              trainer: cls.trainer ? cls.trainer.name : "",
            }
          : null,
      };
    }),
    total,
    page,
    size,
  );
}, { allowSelfMember: true });
