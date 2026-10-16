"use client";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function parse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const msg = json?.error?.message ?? `Request failed (${res.status})`;
    throw new ApiClientError(res.status, msg, json?.error?.code ?? "error", json?.error?.details);
  }
  return json as T;
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch("/api/v1/auth/refresh", { method: "POST" })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  let body = init.body;
  if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  let res = await fetch(path, { ...init, headers, body, credentials: "include" });
  if (res.status === 401 && !path.includes("/auth/")) {
    const okRefresh = await tryRefresh();
    if (okRefresh) res = await fetch(path, { ...init, headers, body, credentials: "include" });
  }
  return parse<T>(res);
}

export const apiGet = <T,>(path: string) => api<T>(path);
export const apiPost = <T,>(path: string, json: unknown) => api<T>(path, { method: "POST", json });
export const apiPatch = <T,>(path: string, json: unknown) => api<T>(path, { method: "PATCH", json });
export const apiDelete = <T,>(path: string) => api<T>(path, { method: "DELETE" });

export type ApiList<T> = { success: true; data: T[]; meta: { total: number; page: number; pageSize: number; totalPages: number } };
export type ApiOne<T> = { success: true; data: T };

export function money(minor: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100);
}

export function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function statusBadgeVariant(status: string): "success" | "warning" | "destructive" | "secondary" | "info" {
  switch (status) {
    case "active":
    case "paid":
    case "success":
    case "sent":
    case "booked":
    case "approved":
      return "success";
    case "pending":
    case "partial":
    case "pending_renewal":
    case "frozen":
    case "waitlisted":
    case "queued":
      return "warning";
    case "expired":
    case "cancelled":
    case "failed":
    case "blocked":
    case "disabled":
    case "refunded":
    case "rejected":
    case "lost":
      return "destructive";
    case "new":
    case "contacted":
    case "trial":
      return "info";
    default:
      return "secondary";
  }
}
