import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { WorkoutPlan } from "@/models/Fitness";
import { withAuth, okPage, ok, badRequest, audit } from "@/lib/api";
import { parsePaging } from "@/lib/utils";
import { MemberProfile } from "@/models/MemberProfile";

export const GET = withAuth("workouts:read", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const url = new URL(req.url);
  const { page, size, skip, limit } = parsePaging(url);
  const filter: Record<string, unknown> = {};
  if (user.role === "member") {
    if (!user.memberProfile) return okPage([], 0, page, size);
    filter.member = user.memberProfile;
    filter.active = true;
  } else {
    const member = url.searchParams.get("member");
    if (member) filter.member = member;
    if (user.role === "trainer" && user.trainerProfile) filter.trainer = user.trainerProfile;
  }
  const [items, total] = await Promise.all([
    WorkoutPlan.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    WorkoutPlan.countDocuments(filter),
  ]);
  return okPage(items.map((w) => ({ ...w, id: String(w._id) })), total, page, size);
});

const exerciseRef = z.object({
  exercise: z.string().min(1),
  sets: z.number().int().min(1).default(3),
  reps: z.string().max(20).default("12"),
  restSeconds: z.number().int().min(0).default(60),
  notes: z.string().max(300).default(""),
});

const schema = z.object({
  name: z.string().min(2).max(100),
  member: z.string().nullable().default(null),
  trainer: z.string().nullable().default(null),
  branch: z.string().nullable().default(null),
  startDate: z.coerce.date().default(() => new Date()),
  endDate: z.coerce.date().nullable().default(null),
  isTemplate: z.boolean().default(false),
  dietNotes: z.string().max(3000).default(""),
  days: z.array(z.object({ day: z.string().max(20), focus: z.string().max(80), exercises: z.array(exerciseRef).default([]) })).default([]),
});

export const POST = withAuth("workouts:create", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const body = schema.parse(await req.json());
  if (!body.member && !body.isTemplate && user.role !== "super_admin" && user.role !== "gym_owner") {
    // trainers may only assign to members
    if (!body.member) throw badRequest("member required unless this is a template");
  }
  if (body.member) {
    const member = await MemberProfile.findById(body.member).lean();
    if (!member) throw badRequest("Member not found");
    // trainer can only assign to own members
    if (user.role === "trainer" && user.trainerProfile && String(member.assignedTrainer ?? "") !== user.trainerProfile) {
      throw badRequest("You can only create plans for members assigned to you");
    }
    if (!body.trainer && user.trainerProfile) body.trainer = user.trainerProfile;
    if (!body.branch) body.branch = String(member.branch);
  }
  const created = await WorkoutPlan.create(body);
  await audit(user, "workout.create", "WorkoutPlan", String(created._id));
  return new Response(JSON.stringify({ success: true, data: { ...created.toObject(), id: String(created._id) } }), { status: 201 });
});
