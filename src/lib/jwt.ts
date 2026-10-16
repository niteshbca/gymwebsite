import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

const enc = new TextEncoder();

export type TokenPayload = {
  sub: string; // user id
  role: string;
  branch?: string | null;
  type: "access" | "refresh";
  jti?: string;
};

function ttlToSeconds(ttl: string, fallback: number): number {
  const m = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!m) return fallback;
  const n = Number(m[1]);
  const unit = m[2];
  const mult = unit === "s" ? 1 : unit === "m" ? 60 : unit === "h" ? 3600 : 86400;
  return n * mult;
}

export async function signAccessToken(payload: Omit<TokenPayload, "type">) {
  return new SignJWT({ ...payload, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ttlToSeconds(env.ACCESS_TOKEN_TTL, 900))
    .sign(enc.encode(env.JWT_ACCESS_SECRET));
}

export async function signRefreshToken(payload: Omit<TokenPayload, "type"> & { jti: string }) {
  return new SignJWT({ ...payload, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ttlToSeconds(env.REFRESH_TOKEN_TTL, 7 * 86400))
    .sign(enc.encode(env.JWT_REFRESH_SECRET));
}

export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, enc.encode(env.JWT_ACCESS_SECRET));
    if (payload.type !== "access") return null;
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, enc.encode(env.JWT_REFRESH_SECRET));
    if (payload.type !== "refresh") return null;
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export const cookieOpts = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: "lax" as const,
  path: "/",
};
