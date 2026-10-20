"use client";

import { useSite } from "@/components/site/shell";

export default function TermsPage() {
  const { data } = useSite();
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold">Terms of Use</h1>
      <div className="mt-6 whitespace-pre-wrap leading-relaxed text-muted-foreground">{data?.settings.terms}</div>
      <div className="mt-8 whitespace-pre-wrap leading-relaxed text-muted-foreground">{data?.settings.membershipPolicy}</div>
    </div>
  );
}
