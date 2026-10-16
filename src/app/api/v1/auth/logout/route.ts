import { cookies } from "next/headers";
import { logout } from "@/server/services/auth";
import { withPublic } from "@/lib/api";

export const POST = withPublic(async () => {
  const store = await cookies();
  const refresh = store.get("fp_refresh")?.value;
  let userId: string | null = null;
  if (refresh) {
    const { verifyRefreshToken } = await import("@/lib/jwt");
    const p = await verifyRefreshToken(refresh);
    userId = p?.sub ?? null;
  }
  return logout(userId);
});
