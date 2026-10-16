import { NextRequest } from "next/server";
import { z } from "zod";
import { registerMember } from "@/server/services/auth";
import { withPublic } from "@/lib/api";

const schema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().min(8).max(15),
  password: z.string().min(8).max(72),
  branchId: z.string().optional(),
});

export const POST = withPublic(async (req: NextRequest) => {
  const body = schema.parse(await req.json());
  const result = await registerMember(body);
  return new Response(JSON.stringify({ success: true, data: result }), { status: 201 });
}, { params: Promise.resolve({}) });
