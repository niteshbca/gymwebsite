"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Dumbbell, LayoutDashboard, CalendarCheck2, Users, CreditCard, Settings,
  ExternalLink, LogOut, Menu, X, Bell, CalendarDays, ClipboardList, ClipboardCheck, Target,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { apiGet, apiPost } from "@/lib/client";
import { useQuery } from "@tanstack/react-query";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarCheck2 },
  { href: "/admin/members", label: "Members", icon: Users },
  { href: "/admin/attendance", label: "Attendance", icon: ClipboardCheck },
];

const NAV_GROUP2 = [
  { href: "/admin/classes", label: "Classes", icon: CalendarDays },
  { href: "/admin/plans", label: "Plans", icon: ClipboardList },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/leads", label: "Leads", icon: Target },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data: me } = useQuery({
    queryKey: ["auth-me"],
    queryFn: async () => (await apiGet<{ data: { name: string; role: string } }>("/api/v1/auth/me")).data,
    retry: false,
    staleTime: 60_000,
  });

  async function logout() {
    try { await apiPost("/api/v1/auth/logout", {}); } catch {}
    router.push("/login");
  }

  const link = (n: { href: string; label: string; icon: typeof LayoutDashboard }) => {
    const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
    return (
      <Link
        key={n.href}
        href={n.href}
        onClick={() => setOpen(false)}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active ? "bg-primary text-primary-foreground" : "text-zinc-300 hover:bg-zinc-800 hover:text-white",
        )}
      >
        <n.icon className="h-4 w-4" />
        {n.label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 lg:hidden">
        <Link href="/admin" className="flex items-center gap-2 font-bold">
          <span className="rounded-lg bg-primary p-1.5 text-primary-foreground"><Dumbbell className="h-4 w-4" /></span>
          Admin
        </Link>
        <button onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r border-zinc-800 bg-zinc-900 p-4 transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}>
          <Link href="/admin" className="mb-8 hidden items-center gap-2 font-bold lg:flex">
            <span className="rounded-lg bg-primary p-1.5 text-primary-foreground"><Dumbbell className="h-5 w-5" /></span>
            <span>FitPro Admin</span>
          </Link>
          <nav className="grid gap-1">
            {NAV.map(link)}
            <p className="mt-5 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Manage</p>
            {NAV_GROUP2.map(link)}
          </nav>
          <div className="absolute inset-x-4 bottom-4 grid gap-1">
            <Link href="/" target="_blank" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800">
              <ExternalLink className="h-4 w-4" /> View website
            </Link>
            <button onClick={logout} className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-300 hover:bg-zinc-800">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="min-h-screen flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mb-6 flex items-center justify-between">
            <div />
            <div className="flex items-center gap-3">
              <span className="relative inline-flex">
                <Bell className="h-5 w-5 text-zinc-400" />
              </span>
              <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium capitalize text-zinc-300">
                {me ? `${me.name} · ${me.role.replace("_", " ")}` : "Staff"}
              </span>
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
