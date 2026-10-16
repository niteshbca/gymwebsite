import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { MemberProfile } from "@/models/MemberProfile";
import { withAuth, okPage, ok, badRequest, audit, scopeFor, forbidden } from "@/lib/api";
import { parsePaging, parseSort, nextSequence } from "@/lib/utils";
import { requirePermission } from "@/lib/api";
import { isSuperScoped } from "@/lib/rbac";
import { memberSchema } from "./schema";

export const GET = withAuth("members:read", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const url = new URL(req.url);
  const { page, size, skip, limit } = parsePaging(url);
  const filter: Record<string, unknown> = { deletedAt: null, ...scopeFor(user) };
  const q = url.searchParams.get("q")?.trim();
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ firstName: rx }, { lastName: rx }, { phone: rx }, { email: rx }, { memberNumber: rx }];
  }
  const status = url.searchParams.get("status");
  if (status) filter.status = status;
  const branch = url.searchParams.get("branch");
  if (branch && isSuperScoped(user.role)) filter.branch = branch;

  const sort = parseSort(url, ["createdAt", "firstName", "joinDate", "memberNumber"], "-createdAt");
  const [items, total] = await Promise.all([
    MemberProfile.find(filter).sort(sort).skip(skip).limit(limit).populate("assignedTrainer", "name").lean(),
    MemberProfile.countDocuments(filter),
  ]);
  return okPage(items.map((m) => ({ ...m, id: String(m._id) })), total, page, size);
});

export const POST = withAuth("members:create", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const body = memberSchema.parse(await req.json());
  if (!isSuperScoped(user.role) && body.branch !== user.branch) throw forbidden("Cannot create members for another branch");

  // Duplicate detection on phone/email within system
  const dup = await MemberProfile.findOne({
    $or: [{ phone: body.phone }, ...(body.email ? [{ email: body.email.toLowerCase() }] : [])],
    deletedAt: null,
  }).lean();
  if (dup) {
    throw badRequest("A member with this phone/email already exists", {
      existingMemberNumber: (dup as { memberNumber: string }).memberNumber,
    });
  }

  const memberNumber = await nextSequence("member", "FIT", 5);
  const created = await MemberProfile.create({ ...body, email: (body.email || "").toLowerCase(), memberNumber });
  await audit(user, "member.create", "MemberProfile", String(created._id), { memberNumber });
  return new Response(JSON.stringify({ success: true, data: { ...created.toObject(), id: String(created._id) } }), { status: 201 });
});
