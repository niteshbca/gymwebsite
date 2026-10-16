import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Branch } from "@/models/Branch";
import { withAuth, ok, okPage, badRequest, audit } from "@/lib/api";
import { parsePaging } from "@/lib/utils";

const schema = z.object({
  code: z.string().min(2).max(10).transform((s) => s.toUpperCase()),
  name: z.string().min(2).max(80),
  address: z.string().max(300).default(""),
  city: z.string().max(80).default(""),
  phone: z.string().max(20).default(""),
  email: z.string().email().or(z.literal("")).default(""),
  timezone: z.string().default("Asia/Kolkata"),
  active: z.boolean().default(true),
});

export const GET = withAuth("branches:read", async (req: NextRequest) => {
  await connectDB();
  const { page, size, skip, limit } = parsePaging(new URL(req.url));
  const filter = {};
  const [items, total] = await Promise.all([Branch.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(), Branch.countDocuments(filter)]);
  return okPage(items.map((b) => ({ ...b, id: String(b._id) })), total, page, size);
});

export const POST = withAuth("branches:create", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const body = schema.parse(await req.json());
  const exists = await Branch.findOne({ code: body.code }).lean();
  if (exists) throw badRequest(`Branch code ${body.code} already exists`);
  const created = await Branch.create(body);
  await audit(user, "branch.create", "Branch", String(created._id), { code: body.code });
  return new Response(JSON.stringify({ success: true, data: { ...created.toObject(), id: String(created._id) } }), { status: 201 });
});
