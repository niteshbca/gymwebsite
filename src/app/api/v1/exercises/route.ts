import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Exercise } from "@/models/Fitness";
import { withAuth, okPage, ok, audit } from "@/lib/api";
import { parsePaging } from "@/lib/utils";

export const GET = withAuth("workouts:read", async (req: NextRequest) => {
  await connectDB();
  const url = new URL(req.url);
  const { page, size, skip, limit } = parsePaging(url);
  const filter: Record<string, unknown> = { active: true };
  const q = url.searchParams.get("q")?.trim();
  if (q) filter.$or = [{ name: new RegExp(q, "i") }, { muscleGroup: new RegExp(q, "i") }];
  const muscle = url.searchParams.get("muscle");
  if (muscle) filter.muscleGroup = muscle;
  const [items, total] = await Promise.all([
    Exercise.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Exercise.countDocuments(filter),
  ]);
  return okPage(items.map((e) => ({ ...e, id: String(e._id) })), total, page, size);
});

const schema = z.object({
  name: z.string().min(2).max(100),
  muscleGroup: z.string().min(2).max(60),
  instructions: z.string().max(3000).default(""),
  defaultSets: z.number().int().min(1).default(3),
  defaultReps: z.string().max(20).default("12"),
  durationSeconds: z.number().int().min(0).default(0),
  restSeconds: z.number().int().min(0).default(60),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
  equipment: z.string().max(80).default(""),
  mediaUrl: z.string().max(500).default(""),
});

export const POST = withAuth("workouts:create", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const body = schema.parse(await req.json());
  const created = await Exercise.create(body);
  await audit(user, "exercise.create", "Exercise", String(created._id));
  return new Response(JSON.stringify({ success: true, data: { ...created.toObject(), id: String(created._id) } }), { status: 201 });
});
