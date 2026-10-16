import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { FitnessProgress } from "@/models/Fitness";
import { withAuth, okPage, ok, badRequest, audit } from "@/lib/api";
import { parsePaging } from "@/lib/utils";
import { MemberProfile } from "@/models/MemberProfile";

export const GET = withAuth(null, async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const url = new URL(req.url);
  const { page, size, skip, limit } = parsePaging(url);
  let memberId = url.searchParams.get("member") ?? "";
  if (user.role === "member") memberId = user.memberProfile ?? "";
  if (!memberId) throw badRequest("member id required");
  // Members may only view their own data (IDOR protection)
  if (user.role === "member" && user.memberProfile !== memberId) throw badRequest("Access denied");
  const filter = { member: memberId };
  const [items, total] = await Promise.all([
    FitnessProgress.find(filter).sort({ recordedAt: -1 }).skip(skip).limit(limit).lean(),
    FitnessProgress.countDocuments(filter),
  ]);
  return okPage(items.map((p) => ({ ...p, id: String(p._id) })), total, page, size);
});

const schema = z.object({
  member: z.string().optional(),
  recordedAt: z.coerce.date().default(() => new Date()),
  weightKg: z.number().min(0).max(400).default(0),
  heightCm: z.number().min(0).max(260).default(0),
  chestCm: z.number().min(0).max(250).default(0),
  waistCm: z.number().min(0).max(250).default(0),
  hipsCm: z.number().min(0).max(250).default(0),
  bicepsCm: z.number().min(0).max(100).default(0),
  bodyFatPercent: z.number().min(0).max(80).default(0),
  notes: z.string().max(1000).default(""),
});

export const POST = withAuth(null, async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const body = schema.parse(await req.json());
  let memberId = body.member ?? "";
  if (user.role === "member") {
    memberId = user.memberProfile ?? "";
    // members may record their own progress when consented
    const profile = await MemberProfile.findById(memberId).lean();
    if (!profile?.consentHealthData) throw badRequest("Please enable health data consent in your profile first");
  }
  if (!memberId) throw badRequest("member id required");
  const member = await MemberProfile.findById(memberId).lean();
  if (!member) throw badRequest("Member not found");
  if (user.role !== "member" && !user.permissions.includes("workouts:create") && !["trainer", "gym_owner", "super_admin", "branch_manager"].includes(user.role)) {
    throw badRequest("Not allowed");
  }
  const created = await FitnessProgress.create({ ...body, member: memberId, recordedBy: user.id });
  await audit(user, "progress.create", "FitnessProgress", String(created._id), { memberId });
  return new Response(JSON.stringify({ success: true, data: { ...created.toObject(), id: String(created._id) } }), { status: 201 });
});
