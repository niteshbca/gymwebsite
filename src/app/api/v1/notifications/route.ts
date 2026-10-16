import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Notification } from "@/models/System";
import { withAuth, okPage, ok } from "@/lib/api";
import { parsePaging } from "@/lib/utils";

export const GET = withAuth(null, async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const { page, size, skip, limit } = parsePaging(new URL(req.url));
  const filter = { user: user.id };
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: user.id, readAt: null }),
  ]);
  const res = okPage(items.map((n) => ({ ...n, id: String(n._id) })), total, page, size);
  const json = await res.json();
  return new Response(JSON.stringify({ ...json, unread }), { status: res.status, headers: res.headers });
});

export const PATCH = withAuth(null, async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const body = z.object({ all: z.boolean().default(true), id: z.string().optional() }).parse(
    await req.json().catch(() => ({ all: true })),
  );
  if (body.id) await Notification.updateOne({ _id: body.id, user: user.id }, { $set: { readAt: new Date() } });
  else await Notification.updateMany({ user: user.id, readAt: null }, { $set: { readAt: new Date() } });
  return ok({ markedRead: true });
});
