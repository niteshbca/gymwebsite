import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Lead } from "@/models/Lead";
import { withAuth, okPage, ok, audit, scopeFor } from "@/lib/api";
import { parsePaging, parseSort } from "@/lib/utils";
import { sendMail, emailTemplates } from "@/lib/mailer";

export const GET = withAuth("leads:read", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const { page, size, skip, limit } = parsePaging(new URL(req.url));
  const filter: Record<string, unknown> = scopeFor(user);
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  if (status) filter.status = status;
  const q = url.searchParams.get("q")?.trim();
  if (q) filter.$or = [{ name: new RegExp(q, "i") }, { phone: new RegExp(q, "i") }, { email: new RegExp(q, "i") }];
  const sort = parseSort(new URL(req.url), ["createdAt", "followUpDate", "status"], "-createdAt");
  const [items, total] = await Promise.all([
    Lead.find(filter).sort(sort).skip(skip).limit(limit).populate("interestedPlan", "name priceMinor").lean(),
    Lead.countDocuments(filter),
  ]);
  return okPage(items.map((l) => ({ ...l, id: String(l._id) })), total, page, size);
});

const schema = z.object({
  name: z.string().min(2).max(80),
  phone: z.string().min(8).max(15),
  email: z.string().email().or(z.literal("")).default(""),
  interestedPlan: z.string().nullable().default(null),
  source: z.enum(["website", "call", "walk_in", "referral", "social", "campaign"]).default("website"),
  branch: z.string().nullable().default(null),
  notes: z.string().max(2000).default(""),
});

/** Public enquiry endpoint (no auth) + staff create. */
export const POST = withAuth(null, async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const body = schema.parse(await req.json());
  const lead = await Lead.create({
    ...body,
    branch: body.branch ?? user.branch,
    assignedTo: user.id,
    status: "new",
    history: [{ at: new Date(), by: user.id, from: "", to: "new", note: "Created" }],
  });
  await audit(user, "lead.create", "Lead", String(lead._id));
  return new Response(JSON.stringify({ success: true, data: { ...lead.toObject(), id: String(lead._id) } }), { status: 201 });
});

export const PATCH = withAuth("leads:update", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const body = z.object({
    id: z.string().min(1),
    status: z.enum(["new", "contacted", "trial", "negotiation", "converted", "lost"]).optional(),
    followUpDate: z.coerce.date().nullable().optional(),
    notes: z.string().max(2000).optional(),
    lostReason: z.string().max(300).optional(),
    assignedTo: z.string().nullable().optional(),
  }).parse(await req.json());
  const lead = await Lead.findById(body.id);
  if (!lead) return ok({ error: "Lead not found" });
  const from = lead.status;
  if (body.status && body.status !== lead.status) {
    lead.history = [...(lead.history ?? []), { at: new Date(), by: user.id, from, to: body.status, note: body.notes ?? "" }];
    lead.status = body.status;
    if (body.status === "lost" && body.lostReason) lead.lostReason = body.lostReason;
  }
  if (body.followUpDate !== undefined) lead.followUpDate = body.followUpDate;
  if (body.notes) lead.notes = body.notes;
  if (body.assignedTo !== undefined) lead.assignedTo = body.assignedTo ? (body.assignedTo as any) : null;
  await lead.save();
  await audit(user, "lead.update", "Lead", String(lead._id), { status: lead.status });
  return ok({ ...lead.toObject(), id: String(lead._id) });
});

void emailTemplates; void sendMail;
