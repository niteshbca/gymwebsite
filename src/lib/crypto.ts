import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { env } from "./env";

/** Audit log writer — never throws into the request path. */
export async function writeAudit(entry: {
  actor: string | null;
  actorRole: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  meta?: Record<string, unknown>;
}) {
  const { connectDB } = await import("./db");
  await connectDB();
  const { AuditLog } = await import("@/models/System");
  await AuditLog.create({
    ...entry,
    ip: null,
    userAgent: null,
  });
}

/** Signed, non-sensitive QR token for member check-in. Contains only member id + expiry. */
export function signQrToken(memberId: string, ttlSeconds = 60 * 60 * 24 * 30): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = `${memberId}.${exp}`;
  const sig = createHmac("sha256", env.JWT_ACCESS_SECRET).update(body).digest("base64url").slice(0, 32);
  return `${body}.${sig}`;
}

export function verifyQrToken(token: string): { memberId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [memberId, expRaw, sig] = parts;
  const exp = Number(expRaw);
  if (!memberId || !Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  const expected = createHmac("sha256", env.JWT_ACCESS_SECRET)
    .update(`${memberId}.${exp}`)
    .digest("base64url")
    .slice(0, 32);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return { memberId };
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(input: string) {
  return createHmac("sha256", env.JWT_REFRESH_SECRET).update(input).digest("hex");
}

/** Gateway webhook signature verification (HMAC-SHA256, header x-fitpro-signature). */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!env.PAYMENT_WEBHOOK_SECRET) return false;
  if (!signature) return false;
  const expected = createHmac("sha256", env.PAYMENT_WEBHOOK_SECRET).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
