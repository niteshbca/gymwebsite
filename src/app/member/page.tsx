"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, CalendarCheck2, Footprints, Activity, QrCode, Clock, CreditCard } from "lucide-react";
import { apiGet, fmtDate, money, statusBadgeVariant } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton, EmptyState } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

type Membership = {
  id: string;
  subscriptionNumber: string;
  status: string;
  effectiveStatus: string;
  startDate: string;
  endDate: string;
  planName: string;
  planCode: string;
  planSnapshot: { name: string; durationValue: number; durationUnit: string; freezeAllowed?: boolean };
  freezeCount: number;
  frozenUntil: string | null;
  totalMinor: number;
  paymentStatus: string;
};

type Me = {
  profile: {
    id: string; memberNumber: string; fullName: string; phone: string; email: string;
    joinDate: string; goals: string; status: string;
  };
  membership: Membership | null;
  qrToken: string;
  stats: { monthAttendance: number; totalAttendance: number; upcomingBookings: number; lastCheckInAt: string | null };
};

type BookingRow = {
  id: string; status: string; occurrenceDate: string; passCode: string;
  class: { name: string; startTime: string; endTime: string; room: string; trainer: string } | null;
};

function daysLeft(endDate: string) {
  const a = new Date(endDate); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

export default function MemberDashboard() {
  const [qrOpen, setQrOpen] = useState(false);
  const { data: me, isLoading } = useQuery({
    queryKey: ["member-me"],
    queryFn: async () => (await apiGet<{ data: Me }>("/api/v1/member/me")).data,
  });
  const { data: bookings } = useQuery({
    queryKey: ["member-bookings", "upcoming", "dash"],
    queryFn: async () => (await apiGet<{ data: BookingRow[] }>("/api/v1/member/bookings?view=upcoming&pageSize=4")).data,
  });

  if (isLoading || !me) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-56 lg:col-span-2" />
          <Skeleton className="h-56" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const m = me.membership;
  const left = m ? daysLeft(m.endDate) : 0;
  const totalDays = m ? Math.max(1, Math.round((new Date(m.endDate).getTime() - new Date(m.startDate).getTime()) / 86400000) + 1) : 1;
  const elapsed = m ? Math.min(totalDays, Math.max(0, totalDays - left)) : 0;

  const stats = [
    { label: "Check-ins this month", value: me.stats.monthAttendance, icon: Footprints },
    { label: "Total check-ins", value: me.stats.totalAttendance, icon: Activity },
    { label: "Upcoming classes", value: me.stats.upcomingBookings, icon: CalendarCheck2 },
    { label: "Last visit", value: me.stats.lastCheckInAt ? new Date(me.stats.lastCheckInAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—", icon: Clock },
  ];

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Welcome back, {me.profile.fullName.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">Member #{me.profile.memberNumber} · joined {fmtDate(me.profile.joinDate)}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Membership card */}
        <Card className="border-border bg-card lg:col-span-2">
          <CardContent className="p-6">
            {!m ? (
              <EmptyState
                title="No active membership"
                description="Visit the front desk or choose a plan to get started."
                action={<Link href="/#plans" className={buttonVariants({ size: "sm" })}>View plans</Link>}
              />
            ) : (
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="grid gap-1">
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold">{m.planSnapshot?.name || m.planName}</p>
                    <Badge variant={statusBadgeVariant(m.effectiveStatus)}>{m.effectiveStatus.replace("_", " ")}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{m.subscriptionNumber} · {m.planSnapshot?.durationValue} {m.planSnapshot?.durationUnit} plan</p>
                  <p className="mt-3 text-sm text-foreground/75">
                    {fmtDate(m.startDate)} → <span className={left <= 7 ? "font-semibold text-red-600" : ""}>{fmtDate(m.endDate)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground/75">
                    {left > 0 ? `${left} day${left === 1 ? "" : "s"} remaining` : "Expired"} · {m.freezeCount} freeze{m.freezeCount === 1 ? "" : "s"} used
                    {m.frozenUntil ? ` · frozen until ${fmtDate(m.frozenUntil)}` : ""}
                  </p>
                  <div className="mt-3 h-2 w-full max-w-md overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${left <= 7 ? "bg-red-500" : "bg-primary"}`}
                      style={{ width: `${Math.min(100, Math.round((elapsed / totalDays) * 100))}%` }}
                    />
                  </div>
                </div>
                <div className="grid shrink-0 gap-2 text-right">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground/75">Balance due</p>
                  <p className="text-xl font-bold">{money(m.totalMinor)}</p>
                  <Badge variant={statusBadgeVariant(m.paymentStatus)} className="justify-self-end">{m.paymentStatus}</Badge>
                  <Button size="sm" variant="outline" className="border-input bg-transparent" onClick={() => setQrOpen(true)}>
                    <QrCode className="mr-2 h-3.5 w-3.5" /> Show QR pass
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {stats.map((s) => (
            <Card key={s.label} className="border-border bg-card">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="rounded-lg bg-muted p-2"><s.icon className="h-4 w-4 text-foreground/75" /></span>
                <div>
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Upcoming bookings */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base">Upcoming classes</CardTitle>
            <CardDescription>Your next booked sessions</CardDescription>
          </div>
          <div className="flex gap-2">
            <Link href="/member/bookings" className={buttonVariants({ size: "sm", variant: "outline" })}>All bookings</Link>
            <Link href="/member/book" className={buttonVariants({ size: "sm" })}><CalendarPlus className="h-3.5 w-3.5" /> Book</Link>
          </div>
        </CardHeader>
        <CardContent>
          {!bookings?.length ? (
            <EmptyState
              title="No upcoming classes"
              description="Book your next session and it will show up here."
              action={<Link href="/member/book" className={buttonVariants({ size: "sm" })}>Browse schedule</Link>}
            />
          ) : (
            <div className="grid gap-2">
              {bookings.map((b) => (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-muted px-2 py-1 text-center">
                      <p className="text-[10px] uppercase text-muted-foreground">{new Date(b.occurrenceDate).toLocaleDateString("en-IN", { weekday: "short" })}</p>
                      <p className="text-sm font-bold">{new Date(b.occurrenceDate).getDate()}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{b.class?.name ?? "Class"}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.class?.startTime}–{b.class?.endTime} · {b.class?.room}
                        {b.class?.trainer ? ` · ${b.class.trainer}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusBadgeVariant(b.status)}>{b.status}</Badge>
                    {b.passCode && <span className="font-mono text-xs text-muted-foreground/75">{b.passCode}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/member/book" className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary">
          <CalendarPlus className="mb-2 h-5 w-5 text-primary" />
          <p className="text-sm font-semibold">Book a class</p>
          <p className="text-xs text-muted-foreground">Browse the weekly schedule</p>
        </Link>
        <Link href="/member/bookings" className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary">
          <CalendarCheck2 className="mb-2 h-5 w-5 text-primary" />
          <p className="text-sm font-semibold">Manage bookings</p>
          <p className="text-xs text-muted-foreground">Cancel or view pass codes</p>
        </Link>
        <Link href="/member/profile" className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary">
          <CreditCard className="mb-2 h-5 w-5 text-primary" />
          <p className="text-sm font-semibold">Membership & profile</p>
          <p className="text-xs text-muted-foreground">Update your details</p>
        </Link>
      </div>

      {/* QR dialog */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Your check-in pass</DialogTitle></DialogHeader>
          <div className="grid justify-center gap-3 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(me.qrToken)}`}
              alt="Check-in QR code"
              className="mx-auto rounded-lg border border-border bg-white p-2"
              width={200}
              height={200}
            />
            <p className="font-mono text-sm">{me.profile.memberNumber}</p>
            <p className="text-xs text-muted-foreground">Show this at the front desk or scanner to check in.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
