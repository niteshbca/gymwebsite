import { connectDB } from "./db";

export async function writeAudit(entry: {
  actor: string | null;
  actorRole: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  meta?: Record<string, unknown>;
}) {
  await connectDB();
  const { AuditLog } = await import("@/models/System");
  await AuditLog.create(entry);
}