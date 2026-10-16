"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { apiPost, ApiClientError } from "@/lib/client";

export default function RegisterPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiPost("/api/v1/auth/register", form);
      setDone(true);
      toast({ title: "Registration successful", description: "You can now sign in.", variant: "success" });
    } catch (err) {
      toast({ title: "Registration failed", description: err instanceof ApiClientError ? err.message : "Try again", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md text-center"><CardContent className="pt-6">
          <p className="font-semibold">Account created 🎉</p>
          <p className="mt-2 text-sm text-muted-foreground">A verification email has been sent (if SMTP is configured). Select a membership plan at the front desk or from the website to activate your membership.</p>
          <Link href="/login"><Button className="mt-6 w-full">Go to login</Button></Link>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Create your account</CardTitle><CardDescription>Join FitPro as a member</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-2"><Label htmlFor="name">Full name</Label><Input id="name" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="grid gap-2"><Label htmlFor="phone">Phone</Label><Input id="phone" required minLength={8} maxLength={15} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="grid gap-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><p className="text-xs text-muted-foreground">8+ chars with upper, lower and a number</p></div>
            <Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create account"}</Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">Already registered? <Link href="/login" className="text-primary hover:underline">Sign in</Link></p>
        </CardContent>
      </Card>
    </div>
  );
}
