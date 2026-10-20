"use client";

import { useMemo, useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarCheck2, Clock, MapPin, User2, Zap } from "lucide-react";
import { useSite } from "@/components/site/shell";
import { Skeleton } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClassBookingDialog } from "@/components/site/class-booking";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1534258936925-c58bed479fcb?auto=format&fit=crop&w=800&q=80",
];

export default function ClassesPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-16"><Skeleton className="h-96" /></div>}>
      <ClassesInner />
    </Suspense>
  );
}

function ClassesInner() {
  const { data, isLoading } = useSite();
  const sp = useSearchParams();
  const bookParam = sp.get("book");
  const [active, setActive] = useState<string | null>(null);
  const [dayFilter, setDayFilter] = useState<number | "all">("all");

  useEffect(() => {
    if (bookParam && data?.classes.some((c) => c.id === bookParam)) setActive(bookParam);
  }, [bookParam, data]);

  const classes = useMemo(() => {
    const list = data?.classes ?? [];
    return dayFilter === "all" ? list : list.filter((c) => c.dayOfWeek === dayFilter);
  }, [data, dayFilter]);

  const activeClass = data?.classes.find((c) => c.id === active) ?? null;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16">
        <Skeleton className="h-10 w-64" />
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-72" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Group classes</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Book your spot online — pick a class, send a request and get your digital entry pass by email once our team confirms it.
            Members can also book instantly from the member portal.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", 1, 2, 3, 4, 5, 6, 0] as const).map((d) => (
            <button
              key={String(d)}
              onClick={() => setDayFilter(d)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                dayFilter === d ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d === "all" ? "All days" : DAYS[d].slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {classes.map((c, i) => {
          const soldOut = c.seatsLeft <= 0;
          return (
            <div key={c.id} className="group flex flex-col overflow-hidden rounded-2xl border bg-background shadow-sm transition-shadow hover:shadow-md">
              <div className="relative h-44 overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.image || FALLBACK_IMAGES[i % FALLBACK_IMAGES.length]}
                  alt={c.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute left-3 top-3 flex gap-2">
                  <Badge variant="info">{DAYS[c.dayOfWeek]}</Badge>
                  {c.intensity && <Badge variant="secondary">{c.intensity}</Badge>}
                </div>
                {soldOut && (
                  <div className="absolute right-3 top-3">
                    <Badge variant="destructive">Full</Badge>
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="text-lg font-bold">{c.name}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2"><Clock className="h-4 w-4" />{c.startTime} – {c.endTime}</p>
                  <p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{c.room}</p>
                  {c.trainerName && <p className="flex items-center gap-2"><User2 className="h-4 w-4" />{c.trainerName}</p>}
                  <p className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    {soldOut ? "Waitlist open — request anyway" : `${c.seatsLeft} of ${c.capacity} seats left for next session`}
                  </p>
                </div>
                <div className="mt-auto pt-4">
                  <Button className="w-full" variant={soldOut ? "outline" : "default"} onClick={() => setActive(c.id)}>
                    <CalendarCheck2 className="mr-2 h-4 w-4" />{soldOut ? "Join waitlist" : "Book this class"}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {classes.length === 0 && (
          <p className="col-span-full py-12 text-center text-muted-foreground">No classes scheduled for this day. Check another day!</p>
        )}
      </div>

      <ClassBookingDialog
        gymName={data?.settings.gymName ?? "our gym"}
        cls={activeClass}
        open={!!activeClass}
        onOpenChange={(v) => { if (!v) setActive(null); }}
      />
    </div>
  );
}
