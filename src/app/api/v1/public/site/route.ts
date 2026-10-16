import { connectDB } from "@/lib/db";
import { getSettings, publicSettings } from "@/models/GymSettings";
import { MembershipPlan } from "@/models/MembershipPlan";
import { ClassModel } from "@/models/Class";
import { Branch } from "@/models/Branch";
import { withPublic, ok } from "@/lib/api";

/** Public website payload: content + active plans + public class schedule. */
export const GET = withPublic(async () => {
  await connectDB();
  const [settings, plans, classes, branches] = await Promise.all([
    getSettings(),
    MembershipPlan.find({ active: true, archived: false }).sort({ sortOrder: 1, priceMinor: 1 }).lean(),
    ClassModel.find({ active: true }).sort({ dayOfWeek: 1, startTime: 1 }).limit(50).lean(),
    Branch.find({ active: true }).select("name city address phone").lean(),
  ]);
  return ok({
    settings: publicSettings(settings),
    plans: plans.map((p) => ({
      id: String(p._id), name: p.name, code: p.code, description: p.description, category: p.category,
      priceMinor: p.priceMinor, taxPercent: p.taxPercent, durationValue: p.durationValue, durationUnit: p.durationUnit,
      joiningFeeMinor: p.joiningFeeMinor, classAccess: p.classAccess, freezeAllowed: p.freezeAllowed,
      includedSessions: p.includedSessions, discountEligible: p.discountEligible,
    })),
    classes: classes.map((c) => ({
      id: String(c._id), name: c.name, description: c.description, dayOfWeek: c.dayOfWeek,
      startTime: c.startTime, endTime: c.endTime, room: c.room, capacity: c.capacity,
    })),
    branches: branches.map((b) => ({ id: String(b._id), name: b.name, city: b.city, address: b.address, phone: b.phone })),
  });
});
