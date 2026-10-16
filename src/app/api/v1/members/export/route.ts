import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { MemberProfile } from "@/models/MemberProfile";
import { withAuth, scopeFor } from "@/lib/api";
import { csvResponse } from "@/lib/utils";

export const GET = withAuth("members:export", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const url = new URL(req.url);
  const filter: Record<string, unknown> = { deletedAt: null, ...scopeFor(user) };
  const status = url.searchParams.get("status");
  if (status) filter.status = status;
  const rows = await MemberProfile.find(filter)
    .select("memberNumber firstName lastName phone email status joinDate source")
    .limit(5000)
    .lean();
  return csvResponse(
    rows.map((m) => ({
      memberNumber: m.memberNumber,
      name: `${m.firstName} ${m.lastName}`.trim(),
      phone: m.phone,
      email: m.email,
      status: m.status,
      joinDate: m.joinDate.toISOString().slice(0, 10),
      source: m.source,
    })),
    `members-${Date.now()}.csv`,
  );
});
