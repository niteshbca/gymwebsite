"use client";

import Link from "next/link";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { apiPost, ApiClientError } from "@/lib/client";
import { Dumbbell } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiPost<{ data: { role: string } }>("/api/v1/auth/login", { email, password });
      const next = sp.get("next");
      if (next) { window.location.href = next; return; }
      const role = res.data.role;
      window.location.href = role === "member" ? "/member" : role === "trainer" ? "/trainer" : "/admin";
    } catch (err) {
      toast({
        title: "Login failed",
        description: err instanceof ApiClientError ? err.message : "Something went wrong",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="rounded-xl bg-primary p-2 text-primary-foreground"><Dumbbell className="h-6 w-6" /></div>
          <CardTitle className="mt-2 text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your NiteshPro account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <div className="flex justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">Forgot?</Link>
              </div>
              <Input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No account? <Link href="/register" className="text-primary hover:underline">Register as a member</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
