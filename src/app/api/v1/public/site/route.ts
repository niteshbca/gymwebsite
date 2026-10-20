import { connectDB } from "@/lib/db";
import { getSettings, publicSettings } from "@/models/GymSettings";
import { MembershipPlan } from "@/models/MembershipPlan";
import { ClassModel, ClassBooking } from "@/models/Class";
import { Branch } from "@/models/Branch";
import { withPublic, ok } from "@/lib/api";
import { nextOccurrence, ymd } from "@/lib/schedule";

/** Public website payload: content + active plans + public class schedule with live seats. */
export const GET = withPublic(async () => {
  await connectDB();
  const now = new Date();
  const [settings, plans, classes, branches] = await Promise.all([
    getSettings(),
    MembershipPlan.find({ active: true, archived: false }).sort({ popular: -1, sortOrder: 1, priceMinor: 1 }).lean(),
    ClassModel.find({ active: true })
      .sort({ dayOfWeek: 1, startTime: 1 })
      .limit(50)
      .populate("trainer", "name photo")
      .lean(),
    Branch.find({ active: true }).select("name city address phone").lean(),
  ]);

  const classList = await Promise.all(
    classes.map(async (c) => {
      const nextDate = nextOccurrence(c.dayOfWeek, now);
      const booked = await ClassBooking.countDocuments({
        class: c._id,
        occurrenceDate: nextDate,
        status: { $in: ["pending", "booked", "waitlisted", "attended"] },
      });
      const trainer = c.trainer as unknown as { name?: string; photo?: string } | null;
      return {
        id: String(c._id),
        name: c.name,
        description: c.description,
        image: c.image,
        intensity: c.intensity,
        trainerName: trainer?.name ?? "",
        dayOfWeek: c.dayOfWeek,
        startTime: c.startTime,
        endTime: c.endTime,
        room: c.room,
        capacity: c.capacity,
        seatsLeft: Math.max(0, c.capacity - booked),
        nextDate: ymd(nextDate),
      };
    }),
  );

  return ok({
    settings: publicSettings(settings),
    plans: plans.map((p) => ({
      id: String(p._id), name: p.name, code: p.code, description: p.description, category: p.category,
      image: p.image, features: p.features, popular: p.popular,
      priceMinor: p.priceMinor, taxPercent: p.taxPercent, durationValue: p.durationValue, durationUnit: p.durationUnit,
      joiningFeeMinor: p.joiningFeeMinor, classAccess: p.classAccess, freezeAllowed: p.freezeAllowed,
      includedSessions: p.includedSessions, discountEligible: p.discountEligible,
    })),
    classes: classList,
    branches: branches.map((b) => ({ id: String(b._id), name: b.name, city: b.city, address: b.address, phone: b.phone })),
  });
});
