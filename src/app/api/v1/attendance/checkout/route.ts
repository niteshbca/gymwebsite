import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { withAuth, ok, badRequest, audit } from "@/lib/api";
import { checkOut } from "@/server/services/attendance";

const schema = z.object({ memberId: z.string().min(1) });

export const POST = withAuth("attendance:checkin", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const body = schema.parse(await req.json());
  const record = await checkOut(body.memberId);
  await audit(user, "attendance.checkout", "Attendance", String(record._id), { memberId: body.memberId });
  return ok({ id: String(record._id), checkOutAt: record.checkOutAt });
});

void badRequest;
