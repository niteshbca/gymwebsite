import { NextRequest } from "next/server";
import { z } from "zod";
import { resetPassword } from "@/server/services/auth";
import { withPublic, ok } from "@/lib/api";

const schema = z.object({ token: z.string().min(10), password: z.string().min(8).max(72) });

export const POST = withPublic(async (req: NextRequest) => {
  const body = schema.parse(await req.json());
  return ok(await resetPassword(body.token, body.password));
}, { params: Promise.resolve({}) });
