import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { hashPassword, verifyPassword, isStrongPassword } from "@/lib/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken, cookieOpts } from "@/lib/jwt";
import { sha256, randomToken } from "@/lib/crypto";
import { badRequest, unauthorized, forbidden, conflict } from "@/lib/api";
import { sendMail, emailTemplates } from "@/lib/mailer";
import { env } from "@/lib/env";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

const ACCESS_COOKIE = "fp_access";
const REFRESH_COOKIE = "fp_refresh";

// In-memory login attempt limiter (per email+ip). Simple, restarts clear it.
const attempts = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || rec.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + 60_000 });
    return;
  }
  rec.count++;
  if (rec.count > env.RATE_LIMIT_LOGIN_PER_MIN) {
    throw unauthorized("Too many login attempts. Try again in a minute.");
  }
}

export async function issueSession(user: { _id: Types.ObjectId; role: string; branch: unknown; email: string }) {
  const userId = String(user._id);
  const branch = user.branch ? String(user.branch) : null;
  const access = await signAccessToken({ sub: userId, role: user.role, branch });
  const jti = randomToken(16);
  const refresh = await signRefreshToken({ sub: userId, role: user.role, branch, jti });
  await User.findByIdAndUpdate(userId, { refreshTokenHash: sha256(refresh) });

  const res = NextResponse.json({ success: true, data: { userId, role: user.role } });
  res.cookies.set(ACCESS_COOKIE, access, { ...cookieOpts, maxAge: 15 * 60 });
  res.cookies.set(REFRESH_COOKIE, refresh, { ...cookieOpts, maxAge: 7 * 86400 });
  return res;
}

export async function login(email: string, password: string, ip = "unknown") {
  await connectDB();
  checkRateLimit(`${email.toLowerCase()}|${ip}`);
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+passwordHash +refreshTokenHash +lockedUntil +failedLoginAttempts");
  if (!user) throw unauthorized("Invalid email or password");
  if (user.lockedUntil && user.lockedUntil > new Date()) throw unauthorized("Account temporarily locked due to failed attempts");
  if (user.status === "disabled") throw forbidden("Account is disabled. Contact the gym administrator.");

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    user.failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1;
    if (user.failedLoginAttempts >= 5) {
      user.lockedUntil = new Date(Date.now() + 15 * 60_000);
      user.failedLoginAttempts = 0;
    }
    await user.save();
    throw unauthorized("Invalid email or password");
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date();
  await user.save();
  return issueSession(user);
}

export async function refreshSession(refreshToken: string | undefined) {
  if (!refreshToken) throw unauthorized("No session");
  const payload = await verifyRefreshToken(refreshToken);
  if (!payload) throw unauthorized("Session expired. Please log in again.");
  await connectDB();
  const user = await User.findById(payload.sub).select("+refreshTokenHash +status");
  if (!user || user.status !== "active") throw unauthorized("Account unavailable");
  if (user.refreshTokenHash !== sha256(refreshToken)) {
    // Reuse detection — revoke
    user.refreshTokenHash = null;
    await user.save();
    throw unauthorized("Session revoked");
  }
  return issueSession(user);
}

export async function logout(userId: string | null) {
  if (userId) {
    await connectDB();
    await User.findByIdAndUpdate(userId, { refreshTokenHash: null });
  }
  const res = NextResponse.json({ success: true, data: { loggedOut: true } });
  res.cookies.set(ACCESS_COOKIE, "", { ...cookieOpts, maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { ...cookieOpts, maxAge: 0 });
  return res;
}

export async function registerMember(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
  branchId?: string;
}) {
  await connectDB();
  const settings = await (await import("@/models/GymSettings")).getSettings();
  if (!settings.allowSelfRegistration) throw forbidden("Self-registration is currently disabled");
  if (!isStrongPassword(input.password)) {
    throw badRequest("Password must be 8+ characters with upper, lower and a number");
  }
  const existing = await User.findOne({ email: input.email.toLowerCase().trim() });
  if (existing) throw conflict("An account with this email already exists");

  let branchId = input.branchId;
  if (!branchId) {
    const { Branch } = await import("@/models/Branch");
    const b = await Branch.findOne({ active: true }).sort({ createdAt: 1 });
    branchId = b ? String(b._id) : undefined;
  }
  if (!branchId) throw badRequest("No branch configured. Please visit the gym to register.");

  const { MemberProfile } = await import("@/models/MemberProfile");
  const { nextSequence } = await import("@/lib/utils");
  const memberNumber = await nextSequence("member", "FIT", 5);

  const user = await User.create({
    email: input.email.toLowerCase().trim(),
    passwordHash: await hashPassword(input.password),
    name: input.name,
    phone: input.phone,
    role: "member",
    branch: branchId,
    status: "active",
    emailVerifiedAt: null,
  });

  const profile = await MemberProfile.create({
    memberNumber,
    user: user._id,
    branch: branchId,
    firstName: input.name.split(" ")[0] ?? input.name,
    lastName: input.name.split(" ").slice(1).join(" "),
    phone: input.phone,
    email: input.email.toLowerCase().trim(),
    joinDate: new Date(),
    source: "website",
    consentMarketing: true,
  });

  await User.findByIdAndUpdate(user._id, { memberProfile: profile._id });

  const token = randomToken(24);
  await User.findByIdAndUpdate(user._id, { verifyTokenHash: sha256(token), verifyTokenExp: new Date(Date.now() + 86400000) });
  const url = `${env.APP_URL}/verify-email?token=${token}`;
  const tpl = emailTemplates.welcome(input.name, url);
  await sendMail({ to: input.email, subject: tpl.subject, html: tpl.html, template: "welcome", entityId: String(user._id) });

  return { userId: String(user._id), memberNumber };
}

export async function verifyEmail(token: string) {
  await connectDB();
  const user = await User.findOne({ verifyTokenHash: sha256(token), verifyTokenExp: { $gt: new Date() } }).select("+verifyTokenHash");
  if (!user) throw badRequest("Verification link is invalid or expired");
  user.emailVerifiedAt = new Date();
  user.verifyTokenHash = null;
  user.verifyTokenExp = null;
  await user.save();
  return { email: user.email };
}

export async function forgotPassword(email: string) {
  await connectDB();
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  // Do not reveal whether the account exists
  if (!user) return { sent: false };
  const token = randomToken(24);
  await User.findByIdAndUpdate(user._id, { resetTokenHash: sha256(token), resetTokenExp: new Date(Date.now() + 30 * 60000) });
  const url = `${env.APP_URL}/reset-password?token=${token}`;
  const tpl = emailTemplates.passwordReset(user.name, url);
  await sendMail({ to: user.email, subject: tpl.subject, html: tpl.html, template: "password_reset", entityId: String(user._id) });
  return { sent: true };
}

export async function resetPassword(token: string, password: string) {
  await connectDB();
  if (!isStrongPassword(password)) throw badRequest("Password must be 8+ characters with upper, lower and a number");
  const user = await User.findOne({ resetTokenHash: sha256(token), resetTokenExp: { $gt: new Date() } }).select("+resetTokenHash");
  if (!user) throw badRequest("Reset link is invalid or expired");
  user.passwordHash = await hashPassword(password);
  user.resetTokenHash = null;
  user.resetTokenExp = null;
  user.refreshTokenHash = null; // revoke all sessions
  await user.save();
  return { ok: true };
}
