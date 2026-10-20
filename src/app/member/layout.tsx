"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Dumbbell, LayoutDashboard, CalendarPlus, CalendarCheck2, User, ExternalLink, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { apiPost } from "@/lib/client";

const NAV = [
  { href: "/member", label: "Dashboard", icon: LayoutDashboard },
  { href: "/member/book", label: "Book a class", icon: CalendarPlus },
  { href: "/member/bookings", label: "My bookings", icon: CalendarCheck2 },
  { href: "/member/profile", label: "Profile", icon: User },
];

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    try { await apiPost("/api/v1/auth/logout", {}); } catch {}
    router.push("/login");
  }

  const link = (n: { href: string; label: string; icon: typeof LayoutDashboard }) => {
    const active = pathname === n.href;
    return (
      <Link
        key={n.href}
        href={n.href}
        onClick={() => setOpen(false)}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active ? "bg-primary text-primary-foreground shadow-md shadow-black/20" : "text-zinc-300 hover:bg-white/[0.07] hover:text-white",
        )}
      >
        <n.icon className="h-4 w-4" />
        {n.label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
        <Link href="/member" className="flex items-center gap-2 font-bold">
          <span className="rounded-lg bg-primary p-1.5 text-primary-foreground"><Dumbbell className="h-4 w-4" /></span>
          NiteshPro
        </Link>
        <button onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <div className="flex">
        <aside className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r border-black/40 bg-[#0E1626] p-4 transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}>
          <Link href="/member" className="mb-8 hidden items-center gap-2.5 lg:flex">
            <span className="rounded-xl bg-primary p-2 shadow-lg shadow-primary/30"><Dumbbell className="h-5 w-5 text-white" /></span>
            <span className="leading-tight">
              <span className="block text-lg font-bold tracking-tight text-white">NiteshPro</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Member Portal</span>
            </span>
          </Link>
          <nav className="grid gap-1">
            {NAV.map(link)}
          </nav>
          <div className="absolute inset-x-4 bottom-4 grid gap-1">
            <Link href="/" target="_blank" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-white/[0.07] hover:text-white">
              <ExternalLink className="h-4 w-4" /> View website
            </Link>
            <button onClick={logout} className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-300 hover:bg-white/[0.07] hover:text-white">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </aside>

        <main className="min-h-screen flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
