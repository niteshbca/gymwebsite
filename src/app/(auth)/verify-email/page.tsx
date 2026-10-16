"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiPost } from "@/lib/client";

function VerifyInner() {
  const sp = useSearchParams();
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const token = sp.get("token");
    if (!token) { setState("error"); setMsg("Missing token"); return; }
    apiPost("/api/v1/auth/verify-email", { token })
      .then(() => setState("ok"))
      .catch((e) => { setState("error"); setMsg(e instanceof Error ? e.message : "Invalid link"); });
  }, [sp]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        {state === "loading" && <p>Verifying...</p>}
        {state === "ok" && (<><p className="font-semibold text-emerald-600">Email verified ✓</p><Link href="/login" className="mt-4 inline-block text-primary hover:underline">Go to login</Link></>)}
        {state === "error" && (<><p className="font-semibold text-destructive">Verification failed</p><p className="mt-2 text-sm text-muted-foreground">{msg}</p></>)}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return <Suspense><VerifyInner /></Suspense>;
}
