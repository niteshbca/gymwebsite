import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Subscription } from "@/models/Subscription";
import { MemberProfile } from "@/models/MemberProfile";
import { createSubscription, toSubscriptionJSON } from "@/server/services/subscription";
import { createInvoice } from "@/server/services/payment";
import { withAuth, okPage, ok, badRequest, audit, scopeFor, forbidden } from "@/lib/api";
import { parsePaging, parseSort } from "@/lib/utils";
import { isSuperScoped } from "@/lib/rbac";

export const GET = withAuth("subscriptions:read", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const url = new URL(req.url);
  const { page, size, skip, limit } = parsePaging(url);
  const filter: Record<string, unknown> = scopeFor(user);
  const status = url.searchParams.get("status");
  if (status) filter.status = status;
  const member = url.searchParams.get("member");
  if (user.role === "member") {
    if (!user.memberProfile) return okPage([], 0, page, size);
    filter.member = user.memberProfile;
  } else if (member) filter.member = member;
  const sort = parseSort(url, ["createdAt", "endDate", "startDate"], "-createdAt");
  const [items, total] = await Promise.all([
    Subscription.find(filter).sort(sort).skip(skip).limit(limit)
      .populate("member", "memberNumber firstName lastName phone")
      .populate("plan", "name code").lean(),
    Subscription.countDocuments(filter),
  ]);
  return okPage(items.map((s) => ({ ...toSubscriptionJSON(s as never), member: s.member, plan: s.plan })), total, page, size);
}, { allowSelfMember: true });

const createSchema = z.object({
  member: z.string().min(1),
  plan: z.string().min(1),
  branch: z.string().min(1),
  startDate: z.coerce.date(),
  trainer: z.string().nullable().optional(),
  discountPercent: z.number().min(0).max(100).default(0),
  discountReason: z.string().max(300).default(""),
  activate: z.boolean().default(true),
  notes: z.string().max(1000).default(""),
  createInvoice: z.boolean().default(true),
});

export const POST = withAuth("subscriptions:create", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const body = createSchema.parse(await req.json());
  if (!isSuperScoped(user.role) && body.branch !== user.branch) throw forbidden("Cross-branch subscription creation denied");

  const member = await MemberProfile.findById(body.member).lean();
  if (!member) throw badRequest("Member not found");
  if (member.status === "blocked") throw badRequest("Member is blocked");

  const sub = await createSubscription({
    memberId: body.member,
    branchId: body.branch,
    planId: body.plan,
    startDate: body.startDate,
    trainerId: body.trainer ?? null,
    discountPercent: body.discountPercent,
    discountReason: body.discountReason,
    source: "reception",
    createdBy: user.id,
    activate: body.activate,
  });

  let invoice = null;
  if (body.createInvoice) {
    invoice = await createInvoice({
      memberId: body.member,
      branchId: body.branch,
      subscriptionId: String(sub._id),
      items: [
        { label: `${sub.planSnapshot.name} (${sub.planSnapshot.durationValue} ${sub.planSnapshot.durationUnit})`, unitMinor: sub.baseMinor },
        ...(sub.joiningFeeMinor > 0 ? [{ label: "Joining fee", unitMinor: sub.joiningFeeMinor }] : []),
      ],
      baseMinor: sub.baseMinor,
      discountMinor: sub.discountMinor,
      taxMinor: sub.taxMinor,
      totalMinor: sub.totalMinor,
      notes: body.notes,
      createdBy: user.id,
    });
  }

  await audit(user, "subscription.create", "Subscription", String(sub._id), {
    subscriptionNumber: sub.subscriptionNumber, totalMinor: sub.totalMinor,
  });
  return new Response(
    JSON.stringify({ success: true, data: { subscription: toSubscriptionJSON(sub), invoice: invoice ? { id: String(invoice._id), invoiceNumber: invoice.invoiceNumber, totalMinor: invoice.totalMinor } : null } }),
    { status: 201 },
  );
});
