"use client";

import { useSite } from "@/components/site/shell";
import { Skeleton } from "@/components/ui/table";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function ClassesPage() {
  const { data, isLoading } = useSite();
  if (isLoading) return <div className="mx-auto max-w-5xl px-4 py-16"><Skeleton className="h-96" /></div>;
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-4xl font-extrabold tracking-tight">Group classes</h1>
      <p className="mt-3 text-muted-foreground">Book classes from your member portal after activating a membership. Drop-ins: contact the front desk.</p>
      <div className="mt-10 grid gap-4">
        {data?.classes.map((c) => (
          <div key={c.id} className="flex flex-col gap-2 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{c.name}</p>
              <p className="text-sm text-muted-foreground">{c.description}</p>
            </div>
            <div className="text-sm sm:text-right">
              <p className="font-medium">{DAYS[c.dayOfWeek]} · {c.startTime}–{c.endTime}</p>
              <p className="text-muted-foreground">{c.room} · {c.capacity} seats</p>
            </div>
          </div>
        ))}
        {data && data.classes.length === 0 && <p className="text-muted-foreground">New schedule coming soon.</p>}
      </div>
    </div>
  );
}
