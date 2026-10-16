import { NextRequest } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { MemberProfile } from "@/models/MemberProfile";
import { Subscription } from "@/models/Subscription";
import { Invoice } from "@/models/Payment";
import { Attendance } from "@/models/Attendance";
import { withAuth, ok, notFound, forbidden, audit, assertBranchAccess } from "@/lib/api";
import { signQrToken } from "@/lib/crypto";
import { toSubscriptionJSON } from "@/server/services/subscription";
import { isSuperScoped } from "@/lib/rbac";
import { memberSchema } from "../schema";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth("members:read", async (_req: NextRequest, ctx: Ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) throw notFound("Member not found");
  const member = await MemberProfile.findById(id).populate("assignedTrainer", "name specialties phone").lean();
  if (!member) throw notFound("Member not found");
  if (!isSuperScoped(user.role) && String(member.branch) !== user.branch) throw forbidden();

  const [subs, invoices, attendance] = await Promise.all([
    Subscription.find({ member: id }).sort({ createdAt: -1 }).limit(50).lean(),
    Invoice.find({ member: id }).sort({ createdAt: -1 }).limit(50).lean(),
    Attendance.find({ member: id }).sort({ checkInAt: -1 }).limit(30).lean(),
  ]);
  return ok({
    ...member,
    id: String(member._id),
    qrToken: signQrToken(String(member._id)),
    subscriptions: subs.map((s) => toSubscriptionJSON(s as never)),
    invoices: invoices.map((i) => ({ id: String(i._id), invoiceNumber: i.invoiceNumber, totalMinor: i.totalMinor, paidMinor: i.paidMinor, status: i.status, issuedAt: i.issuedAt })),
    attendance: attendance.map((a) => ({ id: String(a._id), checkInAt: a.checkInAt, checkOutAt: a.checkOutAt, method: a.method })),
  });
});

const updateSchema = memberSchema.partial();

export const PATCH = withAuth("members:update", async (req: NextRequest, ctx: Ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) throw notFound("Member not found");
  const member = await MemberProfile.findById(id);
  if (!member) throw notFound("Member not found");
  assertBranchAccess(user, String(member.branch));

  const body = updateSchema.parse(await req.json());
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined) continue;
    const from = (member as unknown as Record<string, unknown>)[k];
    if (String(from) !== String(v)) {
      changes[k] = { from, to: v };
      (member as unknown as Record<string, unknown>)[k] = v;
    }
  }
  if (Object.keys(changes).length > 0) {
    member.profileHistory = [
      ...(member.profileHistory ?? []),
      { at: new Date(), by: user.id, changes },
    ];
    await member.save();
    await audit(user, "member.update", "MemberProfile", id, { fields: Object.keys(changes) });
  }
  return ok({ ...member.toObject(), id: String(member._id) });
});

export const DELETE = withAuth("members:delete", async (_req: NextRequest, ctx: Ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  const member = await MemberProfile.findById(id);
  if (!member) throw notFound("Member not found");
  assertBranchAccess(user, String(member.branch));
  // Financial history is NEVER hard-deleted. Soft-delete only.
  member.deletedAt = new Date();
  member.status = "inactive";
  await member.save();
  await audit(user, "member.soft_delete", "MemberProfile", id);
  return ok({ deleted: true, note: "Member soft-deleted; financial history retained" });
});
