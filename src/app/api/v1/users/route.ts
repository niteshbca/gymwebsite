import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { withAuth, okPage, ok, badRequest, audit, forbidden } from "@/lib/api";
import { parsePaging } from "@/lib/utils";
import { hashPassword } from "@/lib/password";
import { ALL_ROLES, isSuperScoped, ROLE_LABELS } from "@/lib/rbac";

export const GET = withAuth("users:read", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const { page, size, skip, limit } = parsePaging(new URL(req.url));
  const filter: Record<string, unknown> = {};
  if (!isSuperScoped(user.role)) filter.branch = user.branch;
  const role = new URL(req.url).searchParams.get("role");
  if (role) filter.role = role;
  const [items, total] = await Promise.all([
    User.find(filter).sort({ name: 1 }).skip(skip).limit(limit).select("name email role branch status lastLoginAt phone").lean(),
    User.countDocuments(filter),
  ]);
  return okPage(items.map((u) => ({ ...u, id: String(u._id), roleLabel: ROLE_LABELS[u.role as never] })), total, page, size);
});

const schema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().max(20).default(""),
  password: z.string().min(8).max(72),
  role: z.enum(ALL_ROLES as [string, ...string[]]),
  branch: z.string().nullable().default(null),
  permissions: z.array(z.string().max(60)).default([]),
});

export const POST = withAuth("users:create", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  if (user.role !== "super_admin" && (schema.parse(await req.json()).role === "super_admin" || user.role !== "gym_owner")) {
    // gym_owner can create staff except super_admin
  }
  const body = schema.parse(await req.json());
  if (body.role === "super_admin" && user.role !== "super_admin") throw forbidden("Only Super Admin can create Super Admins");
  const exists = await User.findOne({ email: body.email.toLowerCase() }).lean();
  if (exists) throw badRequest("Email already in use");
  const created = await User.create({
    name: body.name,
    email: body.email.toLowerCase(),
    phone: body.phone,
    passwordHash: await hashPassword(body.password),
    role: body.role,
    branch: body.branch ?? (isSuperScoped(user.role as never) ? null : user.branch),
    permissions: body.permissions,
    status: "active",
    emailVerifiedAt: new Date(),
  });
  await audit(user, "user.create", "User", String(created._id), { role: body.role });
  return new Response(JSON.stringify({ success: true, data: { id: String(created._id), name: created.name, email: created.email, role: created.role } }), { status: 201 });
});
