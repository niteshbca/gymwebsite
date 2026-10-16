import { NextRequest } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { ClassModel, ClassBooking } from "@/models/Class";
import { withAuth, ok, notFound, forbidden, audit } from "@/lib/api";
import { isSuperScoped } from "@/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };
const patch = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(1000).optional(),
  trainer: z.string().nullable().optional(),
  room: z.string().max(60).optional(),
  capacity: z.number().int().min(1).max(500).optional(),
  waitlistCapacity: z.number().int().min(0).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endDate: z.coerce.date().nullable().optional(),
  bookingWindowHours: z.number().int().min(1).optional(),
  cancelCutoffHours: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export const GET = withAuth("classes:read", async (_req: NextRequest, ctx: Ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  const c = await ClassModel.findById(id).populate("trainer", "name specialties").lean();
  if (!c) throw notFound("Class not found");
  if (!isSuperScoped(user.role) && String(c.branch) !== user.branch) throw forbidden();
  return ok({ ...c, id: String(c._id) });
});

export const PATCH = withAuth("classes:update", async (req: NextRequest, ctx: Ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  const c = await ClassModel.findById(id);
  if (!c) throw notFound("Class not found");
  if (!isSuperScoped(user.role) && String(c.branch) !== user.branch) throw forbidden();
  const body = patch.parse(await req.json());
  Object.assign(c, body);
  await c.save();
  await audit(user, "class.update", "Class", id, { fields: Object.keys(body) });
  return ok({ ...c.toObject(), id: String(c._id) });
});

export const DELETE = withAuth("classes:delete", async (_req: NextRequest, ctx: Ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  const c = await ClassModel.findById(id);
  if (!c) throw notFound("Class not found");
  if (!isSuperScoped(user.role) && String(c.branch) !== user.branch) throw forbidden();
  c.active = false;
  await c.save();
  await audit(user, "class.deactivate", "Class", id);
  return ok({ deactivated: true });
});

void Types;
