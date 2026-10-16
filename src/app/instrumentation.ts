export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureScheduler } = await import("@/server/jobs/scheduler");
    ensureScheduler();
  }
}
