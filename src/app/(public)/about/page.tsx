"use client";

import { useSite } from "@/components/site/shell";

export default function AboutPage() {
  const { data } = useSite();
  const s = data?.settings;
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-4xl font-extrabold tracking-tight">About {s?.gymName ?? "FitPro"}</h1>
      <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{s?.tagline}</p>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        We are a community-first fitness facility with certified coaches, modern equipment and programs for every level —
        from first-timers to competitive athletes. Our team tracks your progress, personalises your plan and keeps you accountable.
      </p>
      <h2 className="mt-12 text-2xl font-bold">Our facilities</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {s?.facilities.map((f, i) => (
          <div key={i} className="rounded-xl border p-5">
            <p className="font-semibold">{f.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{f.description}</p>
          </div>
        ))}
      </div>
      <h2 className="mt-12 text-2xl font-bold">Branches</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {data?.branches.map((b) => (
          <div key={b.id} className="rounded-xl border p-5">
            <p className="font-semibold">{b.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{b.address}, {b.city}</p>
            <p className="text-sm text-muted-foreground">{b.phone}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
