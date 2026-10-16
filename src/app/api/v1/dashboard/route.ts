import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { withAuth, ok, scopeFor } from "@/lib/api";
import { buildDashboard } from "@/server/services/dashboard";

export const GET = withAuth("dashboard:read", async (req: NextRequest, _ctx, user) => {
  await connectDB();
  const url = new URL(req.url);
  const branch = url.searchParams.get("branch");
  const scope = scopeFor(user);
  if (branch && Object.keys(scope).length === 0) scope.branch = branch;
  else if (branch && scope.branch) scope.branch = scope.branch; // branch-scoped users cannot override
  const data = await buildDashboard(scope);
  return ok({ ...data, scope: { role: user.role, branch: scope.branch ?? "all" } });
});
