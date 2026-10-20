"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Star, ChevronDown, Dumbbell, HeartPulse, Users, Sparkles, ArrowRight } from "lucide-react";
import { useSite, type PublicSite } from "@/components/site/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton, EmptyState } from "@/components/ui/table";
import { money } from "@/lib/client";
import { EnquiryForm } from "@/components/site/enquiry-form";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ICONS: Record<string, React.ReactNode> = {
  dumbbell: <Dumbbell className="h-6 w-6" />, heart: <HeartPulse className="h-6 w-6" />, users: <Users className="h-6 w-6" />, sparkles: <Sparkles className="h-6 w-6" />,
};

export default function HomePage() {
  const { data, isLoading } = useSite();
  if (isLoading) {
    return (
      <div className="space-y-8 py-16">
        <div className="mx-auto max-w-3xl space-y-4 px-4"><Skeleton className="h-12 w-3/4" /><Skeleton className="h-6 w-1/2" /></div>
        <div className="mx-auto grid max-w-7xl gap-4 px-4 md:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}</div>
      </div>
    );
  }
  const s = data?.settings;
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#0B1220] text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-transparent to-[#0B1220]" />
        <div className="absolute -top-32 right-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        {s?.hero.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.hero.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        )}
        <div className="relative mx-auto max-w-7xl px-4 py-24 md:py-32">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">{s?.tagline}</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight text-balance md:text-6xl">
            {s?.hero.title ?? "Stronger Every Single Day"}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-zinc-300">{s?.hero.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/contact"><Button size="lg" className="text-base">{s?.hero.ctaText ?? "Start Free Enquiry"} <ArrowRight /></Button></Link>
            <Link href="/plans"><Button size="lg" variant="outline" className="border-white/25 bg-transparent text-base text-white hover:border-primary hover:bg-primary/10">View Plans</Button></Link>
          </div>
        </div>
      </section>

      {/* Facilities */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-3xl font-bold tracking-tight">World-class facilities</h2>
        <p className="mt-2 text-muted-foreground">Everything you need under one roof.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {s?.facilities.map((f, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="rounded-lg bg-primary/10 p-2 text-primary w-fit">{ICONS[f.icon] ?? ICONS.dumbbell}</div>
                <CardTitle className="mt-3 text-base">{f.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{f.description}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Plans */}
      <section className="bg-muted/40 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Membership plans</h2>
              <p className="mt-2 text-muted-foreground">Transparent pricing. No hidden charges.</p>
            </div>
            <Link href="/plans" className="text-sm font-medium text-primary hover:underline">Compare all →</Link>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {data?.plans.slice(0, 3).map((p) => (
              <Card key={p.id} className={`flex flex-col ${p.popular ? "border-primary shadow-md" : ""}`}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{p.name}</CardTitle>
                    {p.popular && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">Popular</span>}
                  </div>
                  <CardDescription>{p.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-3xl font-semibold">{money(p.priceMinor)}
                    <span className="text-sm font-normal text-muted-foreground"> / {p.durationValue} {p.durationUnit}{p.durationValue > 1 ? "s" : ""}</span>
                  </p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {(p.features?.length ? p.features.slice(0, 4) : [
                      p.includedSessions > 0 ? `${p.includedSessions} trainer sessions included` : "Unlimited gym floor access",
                      p.classAccess === "none" ? "No group classes" : "Group classes included",
                      p.freezeAllowed ? "Freeze allowed" : "No freeze",
                    ]).map((f, fi) => (
                      <li key={fi} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />{f}</li>
                    ))}
                    {p.joiningFeeMinor > 0 && <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" />Joining fee {money(p.joiningFeeMinor)}</li>}
                  </ul>
                  <Link href={`/contact?plan=${p.id}`} className="mt-6 block"><Button className="w-full">Enquire about this plan</Button></Link>
                </CardContent>
              </Card>
            ))}
            {(!data || data.plans.length === 0) && <EmptyState title="Plans coming soon" description="Please contact the front desk." />}
          </div>
        </div>
      </section>

      {/* Classes */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-3xl font-bold tracking-tight">Weekly class schedule</h2>
        <div className="mt-8 overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left">
              <tr><th className="p-3 font-medium">Class</th><th className="p-3 font-medium">Day</th><th className="p-3 font-medium">Time</th><th className="p-3 font-medium">Room</th><th className="p-3 font-medium">Seats left</th><th className="p-3 font-medium"></th></tr>
            </thead>
            <tbody>
              {data?.classes.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3">{DAYS[c.dayOfWeek]}</td>
                  <td className="p-3">{c.startTime} – {c.endTime}</td>
                  <td className="p-3">{c.room}</td>
                  <td className="p-3">
                    {c.seatsLeft > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">{c.seatsLeft} left</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Full</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <Link href={`/classes?book=${c.id}`} className="text-sm font-medium text-primary hover:underline">Book →</Link>
                  </td>
                </tr>
              ))}
              {data && data.classes.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Schedule published soon.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Trainers */}
      {s && s.trainersPublic.length > 0 && (
        <section className="bg-muted/40 py-16">
          <div className="mx-auto max-w-7xl px-4">
            <h2 className="text-3xl font-bold tracking-tight">Meet your coaches</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {s.trainersPublic.map((t, i) => (
                <Card key={i}>
                  <CardHeader>
                    {t.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.photo} alt={t.name} className="h-40 w-full rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-40 w-full items-center justify-center rounded-lg bg-muted text-muted-foreground"><Dumbbell className="h-10 w-10" /></div>
                    )}
                    <CardTitle className="mt-3">{t.name}</CardTitle>
                    <CardDescription>{t.specialty}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{t.bio}</CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      {s && s.testimonials.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16">
          <h2 className="text-3xl font-bold tracking-tight">Members love training here</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {s.testimonials.map((t, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="flex gap-1">{Array.from({ length: t.rating }).map((_, j) => <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />)}</div>
                  <p className="mt-3 text-sm">“{t.quote}”</p>
                  <p className="mt-4 text-sm font-semibold">{t.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* FAQ + Enquiry */}
      <section className="bg-muted/40 py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Frequently asked questions</h2>
            <div className="mt-6">
              <Accordion type="single" collapsible>
                {s?.faqs.map((f, i) => (
                  <AccordionItem key={i} value={`faq-${i}`}>
                    <AccordionTrigger>{f.question}</AccordionTrigger>
                    <AccordionContent>{f.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Send an enquiry</h2>
            <p className="mt-2 text-muted-foreground">Our team will call you back within one business day.</p>
            <div className="mt-6"><EnquiryForm plans={data?.plans ?? []} /></div>
          </div>
        </div>
      </section>

      {/* Hours & Location */}
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold">Visit us</h2>
          <p className="mt-3 text-muted-foreground">{s?.address}, {s?.city}</p>
          <p className="mt-2 text-muted-foreground">Phone: {s?.phone} · Email: {s?.email}</p>
          {s?.mapLink && <a href={s.mapLink} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Open in Google Maps →</a>}
        </div>
        <div>
          <h2 className="text-2xl font-bold">Business hours</h2>
          <ul className="mt-3 divide-y rounded-lg border">
            {s?.openingHours.map((h) => (
              <li key={h.day} className="flex justify-between px-4 py-2 text-sm">
                <span>{h.day}</span><span className="text-muted-foreground">{h.closed ? "Closed" : `${h.open} – ${h.close}`}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

void useQuery; void ChevronDown;
