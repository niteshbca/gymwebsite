import { NextRequest } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { MembershipPlan } from "@/models/MembershipPlan";
import { withAuth, ok, notFound, audit } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = planSchemaForPatch();
function planSchemaForPatch() {
  return z.object({
    name: z.string().min(2).max(80).optional(),
    description: z.string().max(1000).optional(),
    priceMinor: z.number().int().min(0).optional(),
    taxPercent: z.number().min(0).max(100).optional(),
    taxInclusive: z.boolean().optional(),
    joiningFeeMinor: z.number().int().min(0).optional(),
    durationValue: z.number().int().min(1).optional(),
    durationUnit: z.enum(["day", "week", "month", "year"]).optional(),
    discountEligible: z.boolean().optional(),
    includedSessions: z.number().int().min(0).optional(),
    accessHours: z.object({ from: z.string(), to: z.string() }).nullable().optional(),
    branchAccess: z.enum(["home", "all"]).optional(),
    classAccess: z.enum(["none", "group", "all"]).optional(),
    freezeAllowed: z.boolean().optional(),
    maxFreezes: z.number().int().min(0).optional(),
    freezeDaysMax: z.number().int().min(0).optional(),
    cancellationRefundPercent: z.number().min(0).max(100).optional(),
    guestPasses: z.number().int().min(0).optional(),
    trainerIncluded: z.boolean().optional(),
    active: z.boolean().optional(),
    archived: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  });
}

export const GET = withAuth("plans:read", async (_req: NextRequest, ctx: Ctx) => {
  await connectDB();
  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) throw notFound("Plan not found");
  const plan = await MembershipPlan.findById(id).lean();
  if (!plan) throw notFound("Plan not found");
  return ok({ ...plan, id: String(plan._id) });
});

export const PATCH = withAuth("plans:update", async (req: NextRequest, ctx: Ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) throw notFound("Plan not found");
  const plan = await MembershipPlan.findById(id);
  if (!plan) throw notFound("Plan not found");
  const body = patchSchema.parse(await req.json());

  // Price changes are appended to history; existing subscriptions keep their snapshot.
  if (body.priceMinor !== undefined && body.priceMinor !== plan.priceMinor) {
    plan.priceHistory = [
      ...(plan.priceHistory ?? []),
      { priceMinor: body.priceMinor, taxPercent: body.taxPercent ?? plan.taxPercent, changedAt: new Date(), changedBy: user.id },
    ];
  }
  Object.assign(plan, body);
  await plan.save();
  await audit(user, "plan.update", "MembershipPlan", id, { fields: Object.keys(body) });
  return ok({ ...plan.toObject(), id: String(plan._id) });
});

export const DELETE = withAuth("plans:delete", async (_req: NextRequest, ctx: Ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  const plan = await MembershipPlan.findById(id);
  if (!plan) throw notFound("Plan not found");
  // Never hard-delete if subscriptions reference it — archive instead.
  plan.archived = true;
  plan.active = false;
  await plan.save();
  await audit(user, "plan.archive", "MembershipPlan", id);
  return ok({ archived: true, note: "Plan archived; existing subscriptions keep their snapshot" });
});
