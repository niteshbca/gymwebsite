import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { MembershipPlan } from "@/models/MembershipPlan";
import { withAuth, ok, okPage, badRequest, audit } from "@/lib/api";
import { parsePaging } from "@/lib/utils";
import { getSettings } from "@/models/GymSettings";

const planSchema = z.object({
  name: z.string().min(2).max(80),
  code: z.string().min(2).max(20).transform((s) => s.toUpperCase()),
  description: z.string().max(1000).default(""),
  category: z.enum(["membership", "personal_training", "class_package", "one_time"]).default("membership"),
  durationValue: z.number().int().min(1),
  durationUnit: z.enum(["day", "week", "month", "year"]).default("month"),
  priceMinor: z.number().int().min(0),
  taxPercent: z.number().min(0).max(100).default(18),
  taxInclusive: z.boolean().default(false),
  joiningFeeMinor: z.number().int().min(0).default(0),
  discountEligible: z.boolean().default(true),
  includedSessions: z.number().int().min(0).default(0),
  accessHours: z.object({ from: z.string(), to: z.string() }).nullable().default(null),
  branchAccess: z.enum(["home", "all"]).default("home"),
  branches: z.array(z.string()).default([]),
  classAccess: z.enum(["none", "group", "all"]).default("group"),
  freezeAllowed: z.boolean().default(true),
  maxFreezes: z.number().int().min(0).default(2),
  freezeDaysMax: z.number().int().min(0).default(30),
  cancellationRefundPercent: z.number().min(0).max(100).default(0),
  renewalRuleDays: z.number().int().min(0).default(0),
  guestPasses: z.number().int().min(0).default(0),
  trainerIncluded: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const GET = withAuth("plans:read", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const url = new URL(req.url);
  const { page, size, skip, limit } = parsePaging(url);
  const filter: Record<string, unknown> = { archived: false };
  if (url.searchParams.get("all") === "true" || user.role === "member") {
    // members and public lists only see active plans
    filter.active = true;
  }
  const [items, total] = await Promise.all([
    MembershipPlan.find(filter).sort({ sortOrder: 1, priceMinor: 1 }).skip(skip).limit(limit).lean(),
    MembershipPlan.countDocuments(filter),
  ]);
  if (user.role === "member") return okPage(items, total, page, size);
  return okPage(items, total, page, size);
});

export const POST = withAuth("plans:create", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const body = planSchema.parse(await req.json());
  const exists = await MembershipPlan.findOne({ code: body.code }).lean();
  if (exists) throw badRequest(`Plan code ${body.code} already exists`);
  const settings = await getSettings();
  const created = await MembershipPlan.create({
    ...body,
    taxPercent: body.taxPercent ?? settings.taxPercentDefault,
    priceHistory: [{ priceMinor: body.priceMinor, taxPercent: body.taxPercent, changedAt: new Date(), changedBy: user.id }],
  });
  await audit(user, "plan.create", "MembershipPlan", String(created._id), { code: body.code });
  return new Response(JSON.stringify({ success: true, data: { ...created.toObject(), id: String(created._id) } }), { status: 201 });
});
