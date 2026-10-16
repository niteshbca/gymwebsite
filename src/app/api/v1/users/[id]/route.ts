import { NextRequest } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { withAuth, ok, notFound, forbidden, audit } from "@/lib/api";
import { isSuperScoped } from "@/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withAuth("users:update", async (req: NextRequest, ctx: Ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) throw notFound("User not found");
  const target = await User.findById(id);
  if (!target) throw notFound("User not found");
  if (!isSuperScoped(user.role) && String(target.branch) !== user.branch) throw forbidden();
  const body = z.object({
    name: z.string().min(2).max(80).optional(),
    phone: z.string().max(20).optional(),
    role: z.string().optional(),
    branch: z.string().nullable().optional(),
    status: z.enum(["active", "disabled", "pending"]).optional(),
    permissions: z.array(z.string()).optional(),
    password: z.string().min(8).max(72).optional(),
  }).parse(await req.json());

  if (body.role === "super_admin" && user.role !== "super_admin") throw forbidden();
  if (body.role) target.role = body.role as typeof target.role;
  if (body.name) target.name = body.name;
  if (body.phone !== undefined) target.phone = body.phone;
  if (body.branch !== undefined) target.branch = body.branch as never;
  if (body.status) target.status = body.status;
  if (body.permissions) target.permissions = body.permissions;
  if (body.password) {
    const { hashPassword } = await import("@/lib/password");
    target.passwordHash = await hashPassword(body.password);
    target.refreshTokenHash = null;
  }
  await target.save();
  await audit(user, "user.update", "User", id, { fields: Object.keys(body).filter((k) => k !== "password") });
  return ok({ id: String(target._id), name: target.name, email: target.email, role: target.role, status: target.status });
});
