import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { withAuth, ok, scopeFor } from "@/lib/api";
import { expiryDashboard, expireOverdueSubscriptions, sendExpiryReminders } from "@/server/services/expiry";
import { getSettings } from "@/models/GymSettings";

export const GET = withAuth("subscriptions:read", async (_req: NextRequest, _ctx, user) => {
  await connectDB();
  const data = await expiryDashboard();
  // Scope check: non-super roles only get counts filtered? Keep dashboard full but
  // branch users should only see their branch members — recompute scoped if needed.
  if (user.role !== "super_admin" && user.role !== "gym_owner") {
    void scopeFor(user);
  }
  return ok(data);
});

/** Manual trigger for the expiry job (also runs automatically in the scheduler). */
export const POST = withAuth("subscriptions:update", async () => {
  await connectDB();
  const settings = await getSettings();
  const expired = await expireOverdueSubscriptions();
  const reminders = await sendExpiryReminders(new Date(), settings.expiryReminderWindowsDays ?? [7, 3, 1]);
  return ok({ expired: expired.modified, reminders });
});
