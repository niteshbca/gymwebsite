import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { TrainingSession } from "@/models/Class";
import { withAuth, okPage, ok, audit, scopeFor } from "@/lib/api";
import { parsePaging } from "@/lib/utils";
import { sendMail, emailTemplates } from "@/lib/mailer";
import { MemberProfile } from "@/models/MemberProfile";
import { fmtDateTime } from "@/lib/time";

export const GET = withAuth(null, async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const { page, size, skip, limit } = parsePaging(new URL(req.url));
  const filter: Record<string, unknown> = {};
  if (user.role === "trainer" && user.trainerProfile) filter.trainer = user.trainerProfile;
  else if (user.role === "member") filter.member = user.memberProfile ?? "__none__";
  else Object.assign(filter, scopeFor(user));
  const status = new URL(req.url).searchParams.get("status");
  if (status) filter.status = status;
  const [items, total] = await Promise.all([
    TrainingSession.find(filter).sort({ scheduledAt: -1 }).skip(skip).limit(limit)
      .populate("member", "memberNumber firstName lastName").populate("trainer", "name").lean(),
    TrainingSession.countDocuments(filter),
  ]);
  return okPage(items.map((s) => ({ ...s, id: String(s._id) })), total, page, size);
});

const schema = z.object({
  trainer: z.string().min(1),
  member: z.string().min(1),
  subscription: z.string().nullable().default(null),
  scheduledAt: z.coerce.date(),
  durationMinutes: z.number().int().min(15).max(240).default(60),
  notes: z.string().max(1000).default(""),
});

export const POST = withAuth(null, async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const body = schema.parse(await req.json());
  if (!["super_admin", "gym_owner", "branch_manager", "receptionist", "trainer"].includes(user.role)) {
    return ok({ error: "Not allowed" }, { status: 403 });
  }
  const created = await TrainingSession.create({ ...body, createdBy: user.id });
  const member = await MemberProfile.findById(body.member).lean();
  if (member?.email) {
    const tpl = emailTemplates.classBooked(`${member.firstName} ${member.lastName}`.trim(), "Personal training session", fmtDateTime(body.scheduledAt));
    await sendMail({ to: member.email, subject: `Session scheduled: ${tpl.subject}`, html: tpl.html, template: "session_scheduled", entityId: String(created._id) });
  }
  await audit(user, "session.create", "TrainingSession", String(created._id));
  return new Response(JSON.stringify({ success: true, data: { ...created.toObject(), id: String(created._id) } }), { status: 201 });
});
