import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { connectDB } from "./db";
import { verifyAccessToken, type TokenPayload } from "./jwt";
import { can, branchScope, effectivePermissions, isSuperScoped, type Role } from "./rbac";
import { writeAudit } from "./audit";
import { cookies } from "next/headers";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "error",
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (m = "Bad request", d?: unknown) => new ApiError(400, m, "bad_request", d);
export const unauthorized = (m = "Authentication required") => new ApiError(401, m, "unauthorized");
export const forbidden = (m = "You do not have permission to perform this action") => new ApiError(403, m, "forbidden");
export const notFound = (m = "Resource not found") => new ApiError(404, m, "not_found");
export const conflict = (m = "Conflict", d?: unknown) => new ApiError(409, m, "conflict", d);

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function okPage<T>(items: T[], total: number, page: number, pageSize: number) {
  return NextResponse.json({
    success: true,
    data: items,
    meta: { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}

export function fail(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { success: false, error: { code: "validation_error", message: "Validation failed", details: error.flatten() } },
      { status: 400 },
    );
  }
  if (error instanceof ApiError) {
    return NextResponse.json(
      { success: false, error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }
  console.error("[api]", error);
  return NextResponse.json(
    { success: false, error: { code: "internal_error", message: "Internal server error" } },
    { status: 500 },
  );
}

export type AuthUser = {
  id: string;
  role: Role;
  branch: string | null;
  email: string;
  name: string;
  permissions: string[];
  memberProfile: string | null;
  trainerProfile: string | null;
  status: string;
};

export async function getSessionUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get("fp_access")?.value;
  if (!token) return null;
  const payload = await verifyAccessToken(token);
  if (!payload) return null;
  await connectDB();
  const { User } = await import("@/models/User");
  const user = await User.findById(payload.sub)
    .select("+refreshTokenHash +status")
    .populate("memberProfile", "_id")
    .populate("trainerProfile", "_id")
    .lean();
  if (!user || user.status !== "active") return null;
  return {
    id: String(user._id),
    role: user.role as Role,
    branch: user.branch ? String(user.branch) : null,
    email: user.email,
    name: user.name,
    permissions: (user.permissions as string[]) ?? [],
    memberProfile: user.memberProfile ? String((user.memberProfile as { _id: unknown })._id ?? user.memberProfile) : null,
    trainerProfile: user.trainerProfile ? String((user.trainerProfile as { _id: unknown })._id ?? user.trainerProfile) : null,
    status: user.status,
  };
}

type Handler<Ctx extends { params: Promise<Record<string, string>> }> = (
  req: NextRequest,
  ctx: Ctx,
  user: AuthUser,
) => Promise<NextResponse | Response>;

type PublicHandler<Ctx extends { params: Promise<Record<string, string>> }> = (
  req: NextRequest,
  ctx: Ctx,
) => Promise<NextResponse | Response>;

/** Wrap an authenticated + authorized handler. */
export function withAuth<Ctx extends { params: Promise<Record<string, string>> }>(
  permission: string | null,
  handler: Handler<Ctx>,
  opts: { allowSelfMember?: boolean } = {},
) {
  return async (req: NextRequest, ctx: Ctx): Promise<NextResponse> => {
    try {
      const user = await getSessionUser();
      if (!user) throw unauthorized();
      const selfMember = opts.allowSelfMember === true && user.role === "member";
      if (permission && !selfMember && !can(user.role, permission, user.permissions)) throw forbidden();
      return (await handler(req, ctx, user)) as NextResponse;
    } catch (e) {
      return fail(e);
    }
  };
}

export function withPublic<Ctx extends { params: Promise<Record<string, string>> }>(
  handler: PublicHandler<Ctx>,
  _opts?: unknown,
) {
  return async (req: NextRequest, ctx: Ctx): Promise<NextResponse> => {
    try {
      return (await handler(req, ctx)) as NextResponse;
    } catch (e) {
      return fail(e);
    }
  };
}

export function requirePermission(user: AuthUser, permission: string) {
  if (!can(user.role, permission, user.permissions)) throw forbidden();
}

export function scopeFor(user: AuthUser, extra: Record<string, unknown> = {}) {
  return { ...branchScope(user.role, user.branch), ...extra };
}

export function assertBranchAccess(user: AuthUser, branchId: string | null | undefined) {
  if (isSuperScoped(user.role)) return;
  if (!branchId || String(branchId) !== user.branch) throw forbidden("Cross-branch access denied");
}

export async function audit(
  user: AuthUser | null,
  action: string,
  entity: string,
  entityId?: string,
  meta?: Record<string, unknown>,
) {
  try {
    await writeAudit({
      actor: user?.id ?? null,
      actorRole: user?.role ?? null,
      action,
      entity,
      entityId: entityId ?? null,
      meta,
    });
  } catch (e) {
    console.error("[audit]", e);
  }
}

export function effectivePerms(user: AuthUser) {
  return effectivePermissions(user.role, user.permissions);
}
