import { NextRequest } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { TrainerProfile } from "@/models/TrainerProfile";
import { MemberProfile } from "@/models/MemberProfile";
import { TrainingSession } from "@/models/Class";
import { withAuth, ok, notFound, forbidden, audit } from "@/lib/api";
import { isSuperScoped } from "@/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };

const patch = z.object({
  name: z.string().min(2).max(80).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().or(z.literal("")).optional(),
  specialties: z.array(z.string()).optional(),
  qualifications: z.array(z.string()).optional(),
  bio: z.string().max(2000).optional(),
  sessionRateMinor: z.number().int().min(0).optional(),
  compensationType: z.enum(["fixed", "per_session", "revenue_share"]).optional(),
  compensationValueMinor: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export const GET = withAuth("trainers:read", async (_req: NextRequest, ctx: Ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  const t = await TrainerProfile.findById(id).lean();
  if (!t) throw notFound("Trainer not found");
  if (!isSuperScoped(user.role) && String(t.branch) !== user.branch && user.trainerProfile !== id) throw forbidden();
  const [assignedMembers, upcoming] = await Promise.all([
    MemberProfile.countDocuments({ assignedTrainer: id, deletedAt: null }),
    TrainingSession.find({ trainer: id, status: "scheduled", scheduledAt: { $gte: new Date() } })
      .sort({ scheduledAt: 1 }).limit(20)
      .populate("member", "memberNumber firstName lastName").lean(),
  ]);
  const json = { ...t, id: String(t._id), assignedMembers, upcomingSessions: upcoming.map((s) => ({ ...s, id: String(s._id) })) };
  // Compensation restricted to authorized roles
  if (!["super_admin", "gym_owner"].includes(user.role)) {
    delete (json as Record<string, unknown>).compensationValueMinor;
    delete (json as Record<string, unknown>).compensationType;
    delete (json as Record<string, unknown>).sessionRateMinor;
  }
  return ok(json);
});

export const PATCH = withAuth("trainers:update", async (req: NextRequest, ctx: Ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  const t = await TrainerProfile.findById(id);
  if (!t) throw notFound("Trainer not found");
  if (!isSuperScoped(user.role) && String(t.branch) !== user.branch) throw forbidden();
  const body = patch.parse(await req.json());
  Object.assign(t, body);
  await t.save();
  await audit(user, "trainer.update", "TrainerProfile", id);
  return ok({ ...t.toObject(), id: String(t._id) });
});

export const DELETE = withAuth("trainers:delete", async (_req: NextRequest, ctx: Ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  const t = await TrainerProfile.findById(id);
  if (!t) throw notFound("Trainer not found");
  t.active = false;
  await t.save();
  await audit(user, "trainer.deactivate", "TrainerProfile", id);
  return ok({ deactivated: true });
});

void Types;
