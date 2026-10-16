import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { GymSettings } from "@/models/GymSettings";
import { withAuth, ok, audit } from "@/lib/api";
import { sendMail } from "@/lib/mailer";
import { usesRealSmtp } from "@/lib/env";

export const GET = withAuth("settings:read", async () => {
  await connectDB();
  const s = await getSettingsSafe();
  return ok(s);
});

const hoursSchema = z.array(z.object({ day: z.string(), open: z.string(), close: z.string(), closed: z.boolean() }));

const patchSchema = z.object({
  gymName: z.string().min(2).max(120).optional(),
  tagline: z.string().max(200).optional(),
  logoUrl: z.string().max(500).optional(),
  address: z.string().max(400).optional(),
  city: z.string().max(80).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().or(z.literal("")).optional(),
  website: z.string().max(200).optional(),
  social: z.object({ facebook: z.string(), instagram: z.string(), youtube: z.string(), twitter: z.string() }).optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().max(60).optional(),
  taxLabel: z.string().max(40).optional(),
  taxPercentDefault: z.number().min(0).max(100).optional(),
  invoicePrefix: z.string().max(10).optional(),
  receiptFooter: z.string().max(500).optional(),
  membershipPolicy: z.string().max(5000).optional(),
  cancellationPolicy: z.string().max(5000).optional(),
  refundPolicy: z.string().max(5000).optional(),
  privacyPolicy: z.string().max(10000).optional(),
  terms: z.string().max(10000).optional(),
  openingHours: hoursSchema.optional(),
  facilities: z.array(z.object({ title: z.string(), description: z.string(), icon: z.string() })).optional(),
  trainersPublic: z.array(z.object({ name: z.string(), specialty: z.string(), photo: z.string(), bio: z.string() })).optional(),
  testimonials: z.array(z.object({ name: z.string(), quote: z.string(), rating: z.number().min(1).max(5) })).optional(),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
  hero: z.object({ title: z.string(), subtitle: z.string(), ctaText: z.string(), imageUrl: z.string() }).optional(),
  gallery: z.array(z.object({ url: z.string(), caption: z.string() })).optional(),
  mapLink: z.string().max(500).optional(),
  expiryReminderWindowsDays: z.array(z.number().int().min(1).max(60)).max(10).optional(),
  allowPartialPayments: z.boolean().optional(),
  allowSelfRegistration: z.boolean().optional(),
  themePrimary: z.string().max(20).optional(),
});

export const PATCH = withAuth("settings:update", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const body = patchSchema.parse(await req.json());
  let s = await GymSettings.findOne();
  if (!s) s = await GymSettings.create({});
  s.set(body);
  await s.save();
  await audit(user, "settings.update", "GymSettings", String(s._id), { fields: Object.keys(body) });
  return ok(s.toObject());
});

async function getSettingsSafe() {
  let s = await GymSettings.findOne().lean();
  if (!s) s = (await GymSettings.create({})).toObject() as any;
  return s;
}

void sendMail; void usesRealSmtp;
