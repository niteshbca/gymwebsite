"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, User, ShieldCheck } from "lucide-react";
import { apiGet, apiPatch, fmtDate, ApiClientError } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

type Me = {
  profile: {
    id: string; memberNumber: string; fullName: string; phone: string; email: string;
    address: string; emergencyContactName: string; emergencyContactPhone: string;
    goals: string; healthInfo: string; consentMarketing: boolean; consentHealthData: boolean;
    joinDate: string; status: string;
  };
  membership: { planSnapshot: { name: string }; endDate: string; effectiveStatus: string } | null;
};

const FIELD_LABELS: Record<string, string> = {
  phone: "Phone",
  email: "Email",
  address: "Address",
  emergencyContactName: "Emergency contact",
  emergencyContactPhone: "Emergency phone",
  goals: "Fitness goals",
  healthInfo: "Health notes",
  consentMarketing: "Marketing consent",
  consentHealthData: "Health data consent",
};

export default function MemberProfilePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: me, isLoading } = useQuery({
    queryKey: ["member-me"],
    queryFn: async () => (await apiGet<{ data: Me }>("/api/v1/member/me")).data,
  });

  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!me) return;
    const p = me.profile;
    setForm({
      phone: p.phone,
      email: p.email,
      address: p.address,
      emergencyContactName: p.emergencyContactName,
      emergencyContactPhone: p.emergencyContactPhone,
      goals: p.goals,
      healthInfo: p.healthInfo,
      consentMarketing: p.consentMarketing,
      consentHealthData: p.consentHealthData,
    });
  }, [me]);

  function set(k: string, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await apiPatch<{ data: { updated: string[] } }>("/api/v1/member/me", {
        phone: form.phone,
        email: form.email,
        address: form.address,
        emergencyContactName: form.emergencyContactName,
        emergencyContactPhone: form.emergencyContactPhone,
        goals: form.goals,
        healthInfo: form.healthInfo,
        consentMarketing: form.consentMarketing,
        consentHealthData: form.consentHealthData,
      });
      toast({
        title: res.data.updated.length ? "Profile updated" : "Nothing to update",
        description: res.data.updated.length ? `Saved: ${res.data.updated.map((f) => FIELD_LABELS[f] ?? f).join(", ")}` : "Your details were already up to date.",
        variant: "success",
      });
      qc.invalidateQueries({ queryKey: ["member-me"] });
    } catch (e) {
      toast({ title: "Update failed", description: e instanceof ApiClientError ? e.message : "Try again", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !me) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-9 w-56" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  const text = (k: string, label: string, type = "text") => (
    <div className="grid gap-1.5">
      <label className="text-xs font-medium text-muted-foreground" htmlFor={k}>{label}</label>
      <Input
        id={k}
        type={type}
        value={String(form[k] ?? "")}
        onChange={(e) => set(k, e.target.value)}
        className="border-input bg-background text-foreground"
      />
    </div>
  );

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">My profile</h1>
        <p className="text-sm text-muted-foreground">Keep your contact details and health notes current.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border bg-card">
          <CardContent className="grid gap-3 p-5 text-sm">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-muted p-2.5"><User className="h-5 w-5 text-foreground/75" /></span>
              <div>
                <p className="font-semibold">{me.profile.fullName}</p>
                <p className="text-xs text-muted-foreground">#{me.profile.memberNumber}</p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={me.profile.status === "active" ? "success" : "secondary"}>{me.profile.status}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Member since</span>
              <span>{fmtDate(me.profile.joinDate)}</span>
            </div>
            {me.membership && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Membership</span>
                <span className="text-right">{me.membership.planSnapshot.name}</span>
              </div>
            )}
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-background p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              Name, membership and payment details are managed by the front desk — contact us to change them.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Contact & health details</CardTitle>
            <CardDescription>Changes are logged and visible to gym staff.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {text("phone", "Phone", "tel")}
              {text("email", "Email", "email")}
            </div>
            {text("address", "Address")}
            <div className="grid gap-4 sm:grid-cols-2">
              {text("emergencyContactName", "Emergency contact name")}
              {text("emergencyContactPhone", "Emergency contact phone", "tel")}
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="goals">Fitness goals</label>
              <textarea
                id="goals"
                value={String(form.goals ?? "")}
                onChange={(e) => set("goals", e.target.value)}
                rows={3}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="e.g. Lose 8 kg in 6 months, run a half marathon..."
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="healthInfo">Health notes</label>
              <textarea
                id="healthInfo"
                value={String(form.healthInfo ?? "")}
                onChange={(e) => set("healthInfo", e.target.value)}
                rows={3}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Injuries, allergies, conditions trainers should know..."
              />
            </div>
            <div className="flex flex-wrap gap-6">
              {(["consentMarketing", "consentHealthData"] as const).map((k) => (
                <label key={k} className="flex cursor-pointer items-center gap-2 text-sm text-foreground/75">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={Boolean(form[k])}
                    onChange={(e) => set(k, e.target.checked)}
                  />
                  {k === "consentMarketing" ? "Marketing emails & offers" : "Share health notes with trainers"}
                </label>
              ))}
            </div>
            <div className="flex justify-end border-t border-border pt-4">
              <Button onClick={save} disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
