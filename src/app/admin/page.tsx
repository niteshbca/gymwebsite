"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Users, UserCheck, IndianRupee, ClipboardCheck, CalendarClock, TrendingUp,
  MessageSquare, ArrowRight, CheckCircle2,
} from "lucide-react";
import { apiGet, apiPatch, money, fmtDate, ApiClientError } from "@/lib/client";
import { Skeleton, EmptyState } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type DashboardData = {
  cards: {
    totalMembers: number; activeMembers: number; expiredMembers: number; expiringSoon: number;
    todayCheckIns: number; newRegistrations: number; newRegistrationsPrev: number;
    monthlyRevenueMinor: number; monthlyRevenueGrowthPct: number; outstandingDuesMinor: number;
    enquiries: number; expensesMinor: number; pendingRegistrations: number; renewalsThisMonth: number; paymentsThisMonth: number;
  };
  revenueTrend: { month: string; revenueMinor: number }[];
  memberTrend: { month: string; count: number }[];
  planDistribution: { name: string; count: number }[];
  classOccupancy: { name: string; booked: number; capacity: number }[];
  checkinTrend: { day: string; count: number }[];
};

type BookingRow = {
  id: string; status: string; guestName: string; guestEmail: string; guestPhone: string;
  occurrenceDate: string; className: string; startTime: string; endTime: string; room: string; source: string;
};

export default function AdminDashboard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => (await apiGet<{ data: DashboardData }>("/api/v1/dashboard")).data,
  });
  const pending = useQuery({
    queryKey: ["admin-bookings-pending"],
    queryFn: async () => (await apiGet<{ data: BookingRow[] }>("/api/v1/bookings?status=pending&pageSize=6")).data,
  });

  async function approve(id: string) {
    try {
      await apiPatch(`/api/v1/bookings/${id}`, { action: "approve" });
      toast({ title: "Booking approved", description: "Digital pass emailed to the customer.", variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin-bookings-pending"] });
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
    } catch (e) {
      toast({ title: "Failed", description: e instanceof ApiClientError ? e.message : "Try again", variant: "error" });
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const c = data?.cards;
  const maxRevenue = Math.max(1, ...(data?.revenueTrend.map((r) => r.revenueMinor) ?? [1]));

  const stats = [
    { label: "Total members", value: String(c?.totalMembers ?? 0), icon: Users, sub: `${c?.activeMembers ?? 0} active` },
    { label: "Monthly revenue", value: money(c?.monthlyRevenueMinor ?? 0), icon: IndianRupee, sub: `${(c?.monthlyRevenueGrowthPct ?? 0) >= 0 ? "+" : ""}${c?.monthlyRevenueGrowthPct ?? 0}% vs last month` },
    { label: "Check-ins today", value: String(c?.todayCheckIns ?? 0), icon: ClipboardCheck, sub: `${c?.renewalsThisMonth ?? 0} renewals this month` },
    { label: "Expiring in 7 days", value: String(c?.expiringSoon ?? 0), icon: CalendarClock, sub: `${c?.expiredMembers ?? 0} expired` },
    { label: "New this month", value: String(c?.newRegistrations ?? 0), icon: TrendingUp, sub: `${c?.newRegistrationsPrev ?? 0} last month` },
    { label: "Outstanding dues", value: money(c?.outstandingDuesMinor ?? 0), icon: IndianRupee, sub: `${c?.paymentsThisMonth ?? 0} payments` },
    { label: "Enquiries", value: String(c?.enquiries ?? 0), icon: MessageSquare, sub: `${c?.pendingRegistrations ?? 0} pending registrations` },
    { label: "Pending bookings", value: String(pending.data?.length ?? 0), icon: UserCheck, sub: "website requests to review" },
  ];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Live figures from your gym operations.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <s.icon className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-2 text-2xl font-extrabold">{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground/75">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending booking requests */}
        <Card className="border-border bg-card">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Booking requests</CardTitle>
              <CardDescription className="text-muted-foreground">Website bookings waiting for approval</CardDescription>
            </div>
            <Link href="/admin/bookings" className="text-sm font-medium text-primary hover:underline">View all →</Link>
          </CardHeader>
          <CardContent>
            {pending.isLoading && <Skeleton className="h-40" />}
            {pending.data && pending.data.length === 0 && (
              <EmptyState title="All caught up" description="No pending booking requests right now." />
            )}
            <div className="grid gap-2">
              {pending.data?.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{b.guestName}</p>
                    <p className="truncate text-xs text-muted-foreground">{b.className} · {fmtDate(b.occurrenceDate)} {b.startTime}</p>
                  </div>
                  <Button size="sm" onClick={() => approve(b.id)}>
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Revenue trend */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Revenue (last 6 months)</CardTitle>
            <CardDescription className="text-muted-foreground">Collected payments per month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-end gap-3">
              {data?.revenueTrend.map((r) => (
                <div key={r.month} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{money(r.revenueMinor)}</span>
                  <div
                    className="w-full rounded-t bg-primary/80 transition-all"
                    style={{ height: `${Math.max(6, (r.revenueMinor / maxRevenue) * 140)}px` }}
                  />
                  <span className="text-xs text-muted-foreground">{r.month}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Class occupancy today */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Today&apos;s class occupancy</CardTitle>
            <CardDescription className="text-muted-foreground">Booked vs capacity</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data?.classOccupancy.length === 0 && <p className="text-sm text-muted-foreground">No classes scheduled today.</p>}
            {data?.classOccupancy.map((o) => {
              const pct = o.capacity ? Math.round((o.booked / o.capacity) * 100) : 0;
              return (
                <div key={o.name}>
                  <div className="flex justify-between text-sm">
                    <span>{o.name}</span>
                    <span className="text-muted-foreground">{o.booked}/{o.capacity}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted">
                    <div className={`h-2 rounded-full ${pct >= 90 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Plan distribution + checkins */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Active plan mix</CardTitle>
            <CardDescription className="text-muted-foreground">Which plans members are on</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data?.planDistribution.length === 0 && <p className="text-sm text-muted-foreground">No active memberships yet.</p>}
            {data?.planDistribution.map((p) => (
              <div key={p.name} className="flex items-center justify-between text-sm">
                <span>{p.name}</span>
                <Badge variant="secondary">{p.count}</Badge>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-border pt-3 text-sm">
              <span className="text-muted-foreground">Check-ins, last 14 days</span>
              <span className="font-semibold">
                {data?.checkinTrend.reduce((a, b) => a + b.count, 0) ?? 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Link href="/admin/bookings">
          <Button variant="outline" className="border-input bg-transparent">
            Manage bookings <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
