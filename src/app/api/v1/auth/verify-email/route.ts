import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyEmail } from "@/server/services/auth";
import { withPublic, ok } from "@/lib/api";

const schema = z.object({ token: z.string().min(10) });

export const POST = withPublic(async (req: NextRequest) => {
  const body = schema.parse(await req.json());
  return ok(await verifyEmail(body.token));
}, { params: Promise.resolve({}) });
