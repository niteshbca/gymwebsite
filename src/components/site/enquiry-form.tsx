"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

export function EnquiryForm({ plans }: { plans: { id: string; name: string }[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", phone: "", email: "", interestedPlan: sp.get("plan") ?? "", message: "", source: "website" as const,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/v1/public/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, interestedPlan: form.interestedPlan || null }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed");
      toast({ title: "Enquiry received!", description: "Our team will call you shortly.", variant: "success" });
      setForm({ name: "", phone: "", email: "", interestedPlan: "", message: "", source: "website" });
      router.refresh();
    } catch (err) {
      toast({ title: "Could not submit enquiry", description: err instanceof Error ? err.message : "Try again later", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={submit} className="grid gap-4" aria-label="Enquiry form">
          <div className="grid gap-2">
            <Label htmlFor="eq-name">Full name *</Label>
            <Input id="eq-name" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="eq-phone">Phone *</Label>
            <Input id="eq-phone" required minLength={8} maxLength={15} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 ..." />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="eq-email">Email</Label>
            <Input id="eq-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="eq-plan">Interested plan</Label>
            <Select id="eq-plan" value={form.interestedPlan} onChange={(e) => setForm({ ...form, interestedPlan: e.target.value })}>
              <option value="">Not sure yet</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="eq-msg">Message</Label>
            <Textarea id="eq-msg" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tell us your fitness goals..." />
          </div>
          <Button type="submit" disabled={loading}>{loading ? "Submitting..." : "Submit enquiry"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
