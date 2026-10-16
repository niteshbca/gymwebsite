import { NextRequest } from "next/server";
import { z } from "zod";
import { forgotPassword } from "@/server/services/auth";
import { withPublic, ok } from "@/lib/api";

const schema = z.object({ email: z.string().email() });

export const POST = withPublic(async (req: NextRequest) => {
  const body = schema.parse(await req.json());
  await forgotPassword(body.email);
  return ok({ message: "If that email exists, a reset link has been sent." });
}, { params: Promise.resolve({}) });
