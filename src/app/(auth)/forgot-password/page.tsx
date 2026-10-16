"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiPost("/api/v1/auth/forgot-password", { email });
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Forgot password</CardTitle><CardDescription>We will email you a reset link (if SMTP is configured).</CardDescription></CardHeader>
        <CardContent>
          {sent ? (
            <p className="text-sm text-muted-foreground">If that email exists, a reset link has been sent. Check your inbox (and spam folder).</p>
          ) : (
            <form onSubmit={submit} className="grid gap-4">
              <div className="grid gap-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <Button type="submit" disabled={loading}>{loading ? "Sending..." : "Send reset link"}</Button>
            </form>
          )}
          <p className="mt-4 text-center text-sm"><Link href="/login" className="text-primary hover:underline">Back to login</Link></p>
        </CardContent>
      </Card>
    </div>
  );
}
