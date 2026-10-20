import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { ClassModel } from "@/models/Class";
import { withAuth, okPage, ok, audit, scopeFor } from "@/lib/api";
import { parsePaging } from "@/lib/utils";

export const GET = withAuth("classes:read", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const { page, size, skip, limit } = parsePaging(new URL(req.url));
  const filter: Record<string, unknown> = { active: true, ...scopeFor(user) };
  const day = new URL(req.url).searchParams.get("day");
  if (day !== null && day !== "") filter.dayOfWeek = Number(day);
  const [items, total] = await Promise.all([
    ClassModel.find(filter).sort({ dayOfWeek: 1, startTime: 1 }).skip(skip).limit(limit)
      .populate("trainer", "name specialties").lean(),
    ClassModel.countDocuments(filter),
  ]);
  return okPage(items.map((c) => ({ ...c, id: String(c._id) })), total, page, size);
}, { allowSelfMember: true });

const schema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(1000).default(""),
  branch: z.string().min(1),
  trainer: z.string().nullable().default(null),
  room: z.string().max(60).default("Main Floor"),
  capacity: z.number().int().min(1).max(500),
  waitlistCapacity: z.number().int().min(0).default(5),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  startDate: z.coerce.date().default(() => new Date()),
  endDate: z.coerce.date().nullable().default(null),
  bookingWindowHours: z.number().int().min(1).default(48),
  cancelCutoffHours: z.number().int().min(0).default(2),
  requiresPlanAccess: z.boolean().default(true),
});

export const POST = withAuth("classes:create", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const body = schema.parse(await req.json());
  const created = await ClassModel.create(body);
  await audit(user, "class.create", "Class", String(created._id), { name: body.name });
  return new Response(JSON.stringify({ success: true, data: { ...created.toObject(), id: String(created._id) } }), { status: 201 });
});
