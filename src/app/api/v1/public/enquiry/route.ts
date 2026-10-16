import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Lead } from "@/models/Lead";
import { withPublic, ok, badRequest } from "@/lib/api";
import { sendMail, emailTemplates } from "@/lib/mailer";
import { getSettings } from "@/models/GymSettings";
import { env } from "@/lib/env";

const schema = z.object({
  name: z.string().min(2).max(80),
  phone: z.string().min(8).max(15),
  email: z.string().email().or(z.literal("")).default(""),
  interestedPlan: z.string().nullable().default(null),
  message: z.string().max(2000).default(""),
  source: z.enum(["website", "call", "walk_in", "referral", "social", "campaign"]).default("website"),
});

/** Public enquiry form — no auth required. Basic in-memory rate limit. */
const bucket = new Map<string, { count: number; resetAt: number }>();

export const POST = withPublic(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  const now = Date.now();
  const rec = bucket.get(ip);
  if (!rec || rec.resetAt < now) bucket.set(ip, { count: 1, resetAt: now + 10 * 60_000 });
  else {
    rec.count++;
    if (rec.count > 5) throw badRequest("Too many enquiries. Please try again later.");
  }

  const body = schema.parse(await req.json());
  await connectDB();
  const settings = await getSettings();
  const lead = await Lead.create({
    name: body.name,
    phone: body.phone,
    email: body.email,
    interestedPlan: body.interestedPlan,
    source: body.source,
    branch: null,
    status: "new",
    notes: body.message,
    history: [{ at: new Date(), by: "website", from: "", to: "new", note: "Website enquiry" }],
  });
  if (body.email) {
    const tpl = emailTemplates.enquiryReceived(body.name);
    await sendMail({ to: body.email, subject: tpl.subject, html: tpl.html, template: "enquiry_received", entityId: String(lead._id) });
  }
  void settings; void env;
  return new Response(JSON.stringify({ success: true, data: { id: String(lead._id), received: true } }), { status: 201 });
});
