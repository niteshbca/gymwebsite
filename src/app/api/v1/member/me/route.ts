import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { MemberProfile } from "@/models/MemberProfile";
import { Attendance } from "@/models/Attendance";
import { ClassBooking } from "@/models/Class";
import { withAuth, ok, badRequest, notFound, audit, type AuthUser } from "@/lib/api";
import { getActiveMembership, toSubscriptionJSON } from "@/server/services/subscription";
import { signQrToken } from "@/lib/crypto";
import { startOfDay } from "date-fns";

async function loadSelfProfile(user: AuthUser) {
  if (!user.memberProfile) throw badRequest("No member profile linked to this account");
  const profile = await MemberProfile.findById(user.memberProfile).lean();
  if (!profile) throw notFound("Member profile not found");
  return profile as unknown as {
    _id: unknown;
    memberNumber: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    address?: string;
    dateOfBirth?: Date | null;
    gender?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    joinDate: Date;
    goals?: string;
    healthInfo?: string;
    consentMarketing: boolean;
    consentHealthData: boolean;
    status: string;
    photo?: string;
    assignedTrainer?: unknown;
    branch: unknown;
  };
}

/** Self profile, active membership, QR pass and portal stats in one call. */
export const GET = withAuth(null, async (_req: NextRequest, _ctx, user) => {
  await connectDB();
  const profile = await loadSelfProfile(user);
  const memberId = String(profile._id);

  const membership = await getActiveMembership(memberId);
  let populatedMembership: (ReturnType<typeof toSubscriptionJSON> & { planName: string; planCode: string }) | null = null;
  if (membership) {
    const withPlan = await membership.populate<{ plan: { name: string; code: string } | null }>("plan", "name code category");
    populatedMembership = {
      ...toSubscriptionJSON(withPlan as never),
      planName: withPlan.plan?.name ?? "",
      planCode: withPlan.plan?.code ?? "",
    };
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const today = startOfDay(new Date());

  const [monthAttendance, totalAttendance, upcomingBookings, lastAttendance] = await Promise.all([
    Attendance.countDocuments({ member: memberId, checkInAt: { $gte: monthStart } }),
    Attendance.countDocuments({ member: memberId }),
    ClassBooking.countDocuments({
      member: memberId,
      status: { $in: ["booked", "waitlisted"] },
      occurrenceDate: { $gte: today },
    }),
    Attendance.findOne({ member: memberId }).sort({ checkInAt: -1 }).lean(),
  ]);

  return ok({
    profile: {
      id: memberId,
      memberNumber: profile.memberNumber,
      firstName: profile.firstName,
      lastName: profile.lastName,
      fullName: `${profile.firstName} ${profile.lastName}`.trim(),
      phone: profile.phone,
      email: profile.email ?? "",
      address: profile.address ?? "",
      dateOfBirth: profile.dateOfBirth ?? null,
      gender: profile.gender ?? "",
      emergencyContactName: profile.emergencyContactName ?? "",
      emergencyContactPhone: profile.emergencyContactPhone ?? "",
      joinDate: profile.joinDate,
      goals: profile.goals ?? "",
      healthInfo: profile.healthInfo ?? "",
      consentMarketing: profile.consentMarketing,
      consentHealthData: profile.consentHealthData,
      status: profile.status,
      photo: profile.photo ?? "",
      assignedTrainer: profile.assignedTrainer ?? null,
    },
    membership: populatedMembership,
    qrToken: signQrToken(memberId),
    stats: {
      monthAttendance,
      totalAttendance,
      upcomingBookings,
      lastCheckInAt: lastAttendance ? (lastAttendance as { checkInAt: Date }).checkInAt : null,
    },
  });
}, { allowSelfMember: true });

const patchSchema = z.object({
  phone: z.string().min(8).max(15).optional(),
  email: z.string().email().or(z.literal("")).optional(),
  address: z.string().max(300).optional(),
  emergencyContactName: z.string().max(80).optional(),
  emergencyContactPhone: z.string().max(15).optional(),
  goals: z.string().max(2000).optional(),
  healthInfo: z.string().max(2000).optional(),
  gender: z.string().max(20).optional(),
  consentMarketing: z.boolean().optional(),
  consentHealthData: z.boolean().optional(),
});

/** Members may update their own contact details / goals. */
export const PATCH = withAuth(null, async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const profile = await MemberProfile.findById(user.memberProfile);
  if (!profile) throw notFound("Member profile not found");

  const body = patchSchema.parse(await req.json());
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined) continue;
    const from = (profile as unknown as Record<string, unknown>)[k];
    if (String(from) !== String(v)) {
      changes[k] = { from, to: v };
      (profile as unknown as Record<string, unknown>)[k] = v;
    }
  }
  if (Object.keys(changes).length > 0) {
    profile.profileHistory = [
      ...(profile.profileHistory ?? []),
      { at: new Date(), by: user.id, changes },
    ];
    await profile.save();
    await audit(user, "member.self_update", "MemberProfile", String(profile._id), { fields: Object.keys(changes) });
  }
  return ok({
    id: String(profile._id),
    phone: profile.phone,
    email: profile.email,
    address: profile.address,
    emergencyContactName: profile.emergencyContactName,
    emergencyContactPhone: profile.emergencyContactPhone,
    goals: profile.goals,
    healthInfo: profile.healthInfo,
    consentMarketing: profile.consentMarketing,
    consentHealthData: profile.consentHealthData,
    updated: Object.keys(changes),
  });
}, { allowSelfMember: true });
