import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/jwt";

const PUBLIC_PREFIXES = [
  "/", "/about", "/facilities", "/trainers", "/plans", "/classes", "/gallery",
  "/testimonials", "/faqs", "/contact", "/privacy", "/terms", "/refund",
  "/login", "/register", "/forgot-password", "/reset-password", "/verify-email",
  "/api/",
];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p)));
}

const DASHBOARD_PREFIXES = ["/admin", "/member", "/trainer", "/reception"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!DASHBOARD_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  const token = req.cookies.get("fp_access")?.value;
  if (!token) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  const payload = await verifyAccessToken(token);
  if (!payload) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete("fp_access");
    res.cookies.delete("fp_refresh");
    return res;
  }
  // Role-based page gating (backend enforces API permissions separately)
  const role = payload.role;
  if (pathname.startsWith("/admin") && !["super_admin", "gym_owner", "branch_manager", "receptionist", "accountant", "trainer"].includes(role)) {
    return NextResponse.redirect(new URL("/member", req.url));
  }
  if (pathname.startsWith("/member") && role !== "member") {
    return NextResponse.redirect(new URL("/admin", req.url));
  }
  if (pathname.startsWith("/trainer") && role !== "trainer") {
    return NextResponse.redirect(new URL(role === "member" ? "/member" : "/admin", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
