import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Attendance } from "@/models/Attendance";
import { MemberProfile } from "@/models/MemberProfile";
import { withAuth, ok, okPage, badRequest, audit, scopeFor } from "@/lib/api";
import { checkIn, validateAccess } from "@/server/services/attendance";
import { verifyQrToken } from "@/lib/crypto";
import { parsePaging, parseDateRange } from "@/lib/utils";

export const GET = withAuth("attendance:read", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const url = new URL(req.url);
  const { page, size, skip, limit } = parsePaging(url);
  const filter: Record<string, unknown> = scopeFor(user);
  const range = parseDateRange(url);
  if (range.from || range.to) {
    filter.checkInAt = {};
    if (range.from) (filter.checkInAt as Record<string, Date>).$gte = range.from;
    if (range.to) (filter.checkInAt as Record<string, Date>).$lte = range.to;
  } else {
    // default: today
    const start = new Date(); start.setHours(0, 0, 0, 0);
    filter.checkInAt = { $gte: start };
  }
  const member = url.searchParams.get("member");
  if (member) filter.member = member;
  const [items, total] = await Promise.all([
    Attendance.find(filter).sort({ checkInAt: -1 }).skip(skip).limit(limit)
      .populate("member", "memberNumber firstName lastName").lean(),
    Attendance.countDocuments(filter),
  ]);
  return okPage(items.map((a) => ({ ...a, id: String(a._id) })), total, page, size);
});

const checkinSchema = z
  .object({
    memberId: z.string().optional(),
    memberNumber: z.string().optional(),
    qrToken: z.string().optional(),
    branch: z.string().optional(),
    method: z.enum(["qr", "member_id", "manual", "reception"]).default("reception"),
  })
  .refine((v) => v.memberId || v.memberNumber || v.qrToken, { message: "memberId, memberNumber or qrToken required" });

export const POST = withAuth("attendance:checkin", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const body = checkinSchema.parse(await req.json());
  const branchId = body.branch ?? user.branch;
  if (!branchId) throw badRequest("Branch required");

  let memberId = body.memberId ?? "";
  let method = body.method;

  if (body.qrToken) {
    const verified = verifyQrToken(body.qrToken);
    if (!verified) throw badRequest("QR code is invalid or expired");
    memberId = verified.memberId;
    method = "qr";
  } else if (body.memberNumber) {
    const member = await MemberProfile.findOne({ memberNumber: body.memberNumber.toUpperCase(), deletedAt: null }).lean();
    if (!member) throw badRequest("Member not found");
    memberId = String((member as { _id: unknown })._id);
    method = method === "reception" ? "member_id" : method;
  }

  const record = await checkIn({ memberId, branchId: String(branchId), method, verifiedBy: user.id });
  await audit(user, "attendance.checkin", "Attendance", String(record._id), { memberId, method });
  const populated = await Attendance.findById(record._id).populate("member", "memberNumber firstName lastName").lean();
  return new Response(JSON.stringify({ success: true, data: { ...populated, id: String(record._id) } }), { status: 201 });
});

void validateAccess;
