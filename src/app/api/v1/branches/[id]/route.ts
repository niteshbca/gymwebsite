import { NextRequest } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Branch } from "@/models/Branch";
import { withAuth, ok, notFound, audit } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };
const patch = z.object({
  name: z.string().min(2).max(80).optional(),
  address: z.string().max(300).optional(),
  city: z.string().max(80).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().or(z.literal("")).optional(),
  timezone: z.string().optional(),
  active: z.boolean().optional(),
  openingHours: z.array(z.object({ day: z.string(), open: z.string(), close: z.string(), closed: z.boolean() })).optional(),
});

export const PATCH = withAuth("branches:update", async (req: NextRequest, ctx: Ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) throw notFound("Branch not found");
  const body = patch.parse(await req.json());
  const b = await Branch.findByIdAndUpdate(id, body, { new: true });
  if (!b) throw notFound("Branch not found");
  await audit(user, "branch.update", "Branch", id);
  return ok({ ...b.toObject(), id: String(b._id) });
});
