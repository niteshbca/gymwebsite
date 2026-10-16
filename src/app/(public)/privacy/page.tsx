"use client";

import { useSite } from "@/components/site/shell";

export default function PrivacyPage() {
  const { data } = useSite();
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-extrabold">Privacy Policy</h1>
      <div className="mt-6 whitespace-pre-wrap leading-relaxed text-muted-foreground">{data?.settings.privacyPolicy}</div>
      <p className="mt-8 text-sm text-muted-foreground">
        We collect only the data required to deliver gym services. Health information is collected with explicit consent and is visible only to authorized staff.
        You may request deletion of your account; financial records are retained as required by law.
      </p>
    </div>
  );
}
