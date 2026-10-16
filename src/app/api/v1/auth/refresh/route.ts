import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { refreshSession } from "@/server/services/auth";
import { withPublic } from "@/lib/api";

export const POST = withPublic(async () => {
  const store = await cookies();
  return refreshSession(store.get("fp_refresh")?.value);
}, { params: Promise.resolve({}) });
