"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { apiPost, ApiClientError } from "@/lib/client";

function ResetInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const token = sp.get("token") ?? "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiPost("/api/v1/auth/reset-password", { token, password });
      toast({ title: "Password updated", description: "Please sign in with your new password.", variant: "success" });
      router.push("/login");
    } catch (err) {
      toast({ title: "Reset failed", description: err instanceof ApiClientError ? err.message : "Try again", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Reset password</CardTitle><CardDescription>Choose a strong new password.</CardDescription></CardHeader>
        <CardContent>
          {!token ? <p className="text-sm text-destructive">Missing reset token. Request a new link.</p> : (
            <form onSubmit={submit} className="grid gap-4">
              <div className="grid gap-2"><Label htmlFor="pw">New password</Label><Input id="pw" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <Button type="submit" disabled={loading}>{loading ? "Updating..." : "Update password"}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetInner /></Suspense>;
}
