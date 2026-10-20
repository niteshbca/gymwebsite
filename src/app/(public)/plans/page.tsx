"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useSite } from "@/components/site/shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { money } from "@/lib/client";
import { Skeleton } from "@/components/ui/table";

export default function PlansPage() {
  const { data, isLoading } = useSite();
  if (isLoading) return <div className="mx-auto grid max-w-7xl gap-5 px-4 py-16 md:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-72" />)}</div>;
  const plans = [...(data?.plans ?? [])].sort((a, b) => a.priceMinor - b.priceMinor);
  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Membership plans</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">Compare plans side by side. All prices include taxes as configured by the gym. Enquire to start your membership — activation happens after payment confirmation at the front desk or online.</p>
      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{p.name}</CardTitle>
                <Badge variant="secondary">{p.category.replace("_", " ")}</Badge>
              </div>
              <CardDescription>{p.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <p className="text-4xl font-extrabold">{money(p.priceMinor)}
                <span className="text-sm font-medium text-muted-foreground"> / {p.durationValue} {p.durationUnit}{p.durationValue > 1 ? "s" : ""}</span>
              </p>
              {p.joiningFeeMinor > 0 && <p className="mt-1 text-sm text-muted-foreground">+ {money(p.joiningFeeMinor)} joining fee</p>}
              <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />{p.includedSessions > 0 ? `${p.includedSessions} PT sessions included` : "Full gym floor access"}</li>
                <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />{p.classAccess === "none" ? "Group classes not included" : p.classAccess === "all" ? "All classes + special sessions" : "All group classes included"}</li>
                <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />{p.freezeAllowed ? "Membership freeze available" : "No freeze on this plan"}</li>
                <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />{data?.settings.taxLabel ?? "GST"} calculated at checkout</li>
              </ul>
              <Link href={`/contact?plan=${p.id}`} className="mt-6"><Button className="w-full">Get started</Button></Link>
            </CardContent>
          </Card>
        ))}
        {plans.length === 0 && <p className="text-muted-foreground">Plans will be published shortly. Please contact us for details.</p>}
      </div>
    </div>
  );
}
