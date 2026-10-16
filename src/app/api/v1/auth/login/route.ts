import { NextRequest } from "next/server";
import { z } from "zod";
import { login } from "@/server/services/auth";
import { withPublic } from "@/lib/api";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export const POST = withPublic(async (req: NextRequest) => {
  const body = schema.parse(await req.json());
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  return login(body.email, body.password, ip);
}, { params: Promise.resolve({}) });
