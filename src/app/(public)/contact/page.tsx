"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useSite } from "@/components/site/shell";
import { EnquiryForm } from "@/components/site/enquiry-form";
import { MapPin, Phone, Mail } from "lucide-react";

function ContactInner() {
  const { data } = useSite();
  const sp = useSearchParams();
  const s = data?.settings;
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Contact & enquiry</h1>
      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold">Visit or call us</h2>
          <div className="mt-4 space-y-3 text-muted-foreground">
            <p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{s?.address}, {s?.city}</p>
            <p className="flex items-center gap-2"><Phone className="h-4 w-4" />{s?.phone}</p>
            <p className="flex items-center gap-2"><Mail className="h-4 w-4" />{s?.email}</p>
          </div>
          {s?.mapLink && <a href={s.mapLink} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Get directions →</a>}
          <h2 className="mt-10 text-xl font-semibold">Opening hours</h2>
          <ul className="mt-4 divide-y rounded-lg border">
            {s?.openingHours.map((h) => (
              <li key={h.day} className="flex justify-between px-4 py-2 text-sm"><span>{h.day}</span><span className="text-muted-foreground">{h.closed ? "Closed" : `${h.open} – ${h.close}`}</span></li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-4 text-xl font-semibold">Send an enquiry{sp.get("plan") ? " (plan selected)" : ""}</h2>
          <EnquiryForm plans={data?.plans ?? []} />
        </div>
      </div>
    </div>
  );
}

export default function ContactPage() {
  return <Suspense><ContactInner /></Suspense>;
}
