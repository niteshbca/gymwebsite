"use client";

import { useSite } from "@/components/site/shell";

export default function RefundPage() {
  const { data } = useSite();
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-extrabold">Cancellation & Refund Policy</h1>
      <h2 className="mt-8 text-lg font-semibold">Cancellation</h2>
      <div className="mt-2 whitespace-pre-wrap leading-relaxed text-muted-foreground">{data?.settings.cancellationPolicy}</div>
      <h2 className="mt-8 text-lg font-semibold">Refunds</h2>
      <div className="mt-2 whitespace-pre-wrap leading-relaxed text-muted-foreground">{data?.settings.refundPolicy}</div>
    </div>
  );
}
