import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { TrainerProfile } from "@/models/TrainerProfile";
import { withAuth, okPage, ok, audit, scopeFor } from "@/lib/api";
import { parsePaging } from "@/lib/utils";

export const GET = withAuth("trainers:read", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const { page, size, skip, limit } = parsePaging(new URL(req.url));
  const filter: Record<string, unknown> = scopeFor(user);
  const [items, total] = await Promise.all([
    TrainerProfile.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    TrainerProfile.countDocuments(filter),
  ]);
  return okPage(items.map((t) => ({ ...t, id: String(t._id) })), total, page, size);
});

const schema = z.object({
  name: z.string().min(2).max(80),
  phone: z.string().max(20).default(""),
  email: z.string().email().or(z.literal("")).default(""),
  branch: z.string().min(1),
  specialties: z.array(z.string().max(60)).default([]),
  qualifications: z.array(z.string().max(120)).default([]),
  bio: z.string().max(2000).default(""),
  sessionRateMinor: z.number().int().min(0).default(0),
  compensationType: z.enum(["fixed", "per_session", "revenue_share"]).default("per_session"),
  compensationValueMinor: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export const POST = withAuth("trainers:create", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const body = schema.parse(await req.json());
  const created = await TrainerProfile.create(body);
  await audit(user, "trainer.create", "TrainerProfile", String(created._id));
  return new Response(JSON.stringify({ success: true, data: { ...created.toObject(), id: String(created._id) } }), { status: 201 });
});
