import { connectDB } from "@/lib/db";
import { expireOverdueSubscriptions, sendExpiryReminders } from "@/server/services/expiry";
import { env } from "@/lib/env";

/**
 * In-process scheduler (enabled with ENABLE_SCHEDULER=true).
 * Uses atomic updates + unique ReminderLog keys so it is safe across
 * restarts and multiple ticks; no duplicate emails.
 */
const INTERVAL_MS = 5 * 60 * 1000;
let timer: NodeJS.Timeout | null = null;
let running = false;

export async function runExpiryJobs() {
  if (running) return;
  running = true;
  try {
    const { getSettings } = await import("@/models/GymSettings");
    await connectDB();
    const settings = await getSettings();
    const expired = await expireOverdueSubscriptions();
    const reminders = await sendExpiryReminders(new Date(), settings.expiryReminderWindowsDays?.length ? settings.expiryReminderWindowsDays : env.EXPIRY_REMINDER_WINDOWS_DAYS);
    console.log(`[scheduler] expired=${expired.modified} reminders sent=${reminders.sent} dup=${reminders.duplicates} failed=${reminders.failed} skipped=${reminders.skipped}`);
  } catch (e) {
    console.error("[scheduler] run failed:", e instanceof Error ? e.message : e);
  } finally {
    running = false;
  }
}

export function startScheduler() {
  if (!env.ENABLE_SCHEDULER || timer) return;
  // stagger initial run to avoid cold-start stampede
  timer = setInterval(() => { void runExpiryJobs(); }, INTERVAL_MS);
  timer.unref?.();
  console.log("[scheduler] expiry job started (every 5 min)");
}

export function stopScheduler() {
  if (timer) { clearInterval(timer); timer = null; }
}

declare global {
  // eslint-disable-next-line no-var
  var __fitproScheduler: boolean | undefined;
}

export function ensureScheduler() {
  if (!env.ENABLE_SCHEDULER) return;
  if (globalThis.__fitproScheduler) return;
  globalThis.__fitproScheduler = true;
  startScheduler();
}
