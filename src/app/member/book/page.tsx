"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Users, Clock, MapPin, CheckCircle2 } from "lucide-react";
import { apiGet, apiPost, ApiClientError } from "@/lib/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton, EmptyState } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import Link from "next/link";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_CHIPS = [
  { key: "today", label: "Today" },
  { key: "all", label: "All week" },
  ...[1, 2, 3, 4, 5, 6, 0].map((d) => ({ key: String(d), label: DAYS[d].slice(0, 3) })),
];

type ClassRow = {
  id: string; name: string; description: string; dayOfWeek: number;
  startTime: string; endTime: string; room: string; capacity: number; waitlistCapacity: number;
  image: string; startDate: string; endDate: string | null; requiresPlanAccess: boolean; active: boolean;
  trainer: { _id: string; name: string; specialties?: string } | null;
};

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nextOccurrences(dayOfWeek: number, count: number, startDate?: string, endDate?: string | null) {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  const from = startDate ? new Date(startDate) : null;
  const to = endDate ? new Date(endDate) : null;
  for (let i = 0; i < 49 && out.length < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (d.getDay() !== dayOfWeek) continue;
    if (from && d.getTime() < from.getTime()) continue;
    if (to && d.getTime() > to.getTime()) continue;
    out.push({ value: ymd(d), label: d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" }) });
  }
  return out;
}

export default function MemberBookPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const todayKey = String(new Date().getDay());
  const [day, setDay] = useState<string>("today");
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<ClassRow | null>(null);
  const [occDate, setOccDate] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["member-classes"],
    queryFn: async () => (await apiGet<{ data: ClassRow[] }>("/api/v1/classes?pageSize=100")).data,
  });

  const filtered = useMemo(() => {
    let items = data ?? [];
    const key = day === "today" ? todayKey : day;
    if (day !== "all") items = items.filter((c) => String(c.dayOfWeek) === key);
    if (q.trim()) {
      const needle = q.toLowerCase();
      items = items.filter(
        (c) => c.name.toLowerCase().includes(needle) || c.room.toLowerCase().includes(needle) || (c.trainer?.name ?? "").toLowerCase().includes(needle),
      );
    }
    return items;
  }, [data, day, q, todayKey]);

  function openBooking(c: ClassRow) {
    const occs = nextOccurrences(c.dayOfWeek, 6, c.startDate, c.endDate);
    setTarget(c);
    setOccDate(occs[0]?.value ?? "");
  }

  async function book() {
    if (!target || !occDate) return;
    setBusy(true);
    try {
      const res = await apiPost<{ data: { status: string } }>(`/api/v1/classes/${target.id}/book`, { occurrenceDate: occDate });
      const label = new Date(occDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
      if (res.data.status === "waitlisted") {
        toast({ title: "Added to waitlist", description: `${target.name} on ${label} is full — you are next in line.`, variant: "default" });
      } else {
        toast({ title: "Seat booked", description: `${target.name} on ${label} at ${target.startTime}.`, variant: "success" });
      }
      setTarget(null);
      qc.invalidateQueries({ queryKey: ["member-bookings"] });
      qc.invalidateQueries({ queryKey: ["member-me"] });
    } catch (e) {
      toast({ title: "Booking failed", description: e instanceof ApiClientError ? e.message : "Try again", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  const occs = target ? nextOccurrences(target.dayOfWeek, 6, target.startDate, target.endDate) : [];

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Book a class</h1>
          <p className="text-sm text-zinc-400">Pick a session and reserve your seat instantly.</p>
        </div>
        <Link href="/member/bookings" className={buttonVariants({ size: "sm", variant: "outline" })}>My bookings</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {DAY_CHIPS.map((c) => (
          <button
            key={c.key}
            onClick={() => setDay(c.key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              day === c.key ? "bg-primary text-primary-foreground" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            {c.label}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-56">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search class, room, trainer..."
            className="border-zinc-700 bg-zinc-900 pl-8 text-zinc-100 placeholder:text-zinc-500"
          />
          <span className="absolute left-2.5 top-2.5 text-zinc-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" /></svg>
          </span>
        </div>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <EmptyState title="No classes found" description="Try a different day or clear the search." />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <Card key={c.id} className="overflow-hidden border-zinc-800 bg-zinc-900">
            <div className="relative h-32 bg-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.image || "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=60"} alt={c.name} className="h-full w-full object-cover opacity-80" />
              <div className="absolute left-2 top-2 flex gap-1.5">
                <Badge variant="secondary" className="bg-zinc-950/80 text-zinc-200">{DAYS[c.dayOfWeek].slice(0, 3)}</Badge>
                {c.requiresPlanAccess && <Badge variant="info">Members</Badge>}
              </div>
            </div>
            <CardContent className="grid gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold leading-tight">{c.name}</p>
                <Badge variant="success">Active</Badge>
              </div>
              {c.description && <p className="line-clamp-2 text-xs text-zinc-400">{c.description}</p>}
              <div className="grid gap-1 text-xs text-zinc-300">
                <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-zinc-500" /> {c.startTime}–{c.endTime}</span>
                <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-zinc-500" /> {c.room}</span>
                <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-zinc-500" /> Up to {c.capacity} people</span>
                {c.trainer && <span className="text-zinc-400">Coach: {c.trainer.name}</span>}
              </div>
              <Button
                size="sm"
                className="mt-2 w-full"
                onClick={() => openBooking(c)}
                disabled={nextOccurrences(c.dayOfWeek, 1, c.startDate, c.endDate).length === 0}
              >
                <CalendarPlus className="h-3.5 w-3.5" /> Book seat
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Booking dialog */}
      <Dialog open={!!target} onOpenChange={(v) => !v && setTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Book {target?.name}</DialogTitle>
            <DialogDescription>
              {target ? `${DAYS[target.dayOfWeek]}s · ${target.startTime}–${target.endTime} · ${target.room}` : ""}
            </DialogDescription>
          </DialogHeader>

          {occs.length === 0 ? (
            <p className="text-sm text-zinc-400">This class has no upcoming dates right now.</p>
          ) : (
            <div className="grid gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Choose a date</p>
              {occs.map((o) => (
                <label
                  key={o.value}
                  className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                    occDate === o.value ? "border-primary bg-primary/10" : "border-zinc-700 hover:border-zinc-500"
                  }`}
                >
                  <span>{o.label}</span>
                  <input
                    type="radio"
                    name="occurrence"
                    className="accent-primary"
                    checked={occDate === o.value}
                    onChange={() => setOccDate(o.value)}
                  />
                </label>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" className="border-zinc-700 bg-transparent" onClick={() => setTarget(null)}>Cancel</Button>
            <Button disabled={busy || !occDate} onClick={book}>
              {busy ? "Booking..." : <><CheckCircle2 className="h-4 w-4" /> Confirm booking</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
