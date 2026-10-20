"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, QrCode, Phone, Mail, MapPin, CreditCard, Footprints, CalendarPlus } from "lucide-react";
import { apiGet, apiPost, money, fmtDate, fmtDateTime, statusBadgeVariant, ApiClientError } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Skeleton, EmptyState } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

type Sub = {
  id: string; subscriptionNumber: string; status: string; effectiveStatus: string;
  startDate: string; endDate: string; planSnapshot: { name: string; durationValue: number; durationUnit: string };
  totalMinor: number; balanceMinor: number; paymentStatus: string; freezeCount: number;
};
type Invoice = { id: string; invoiceNumber: string; totalMinor: number; paidMinor: number; status: string; issuedAt: string };
type Attendance = { id: string; checkInAt: string; method: string };
type MemberDetail = {
  id: string; memberNumber: string; firstName: string; lastName: string;
  phone: string; email: string; address: string; status: string; joinDate: string;
  goals: string; healthInfo: string; emergencyContactName: string; emergencyContactPhone: string;
  branch: string; qrToken: string;
  assignedTrainer: { name: string } | null;
  subscriptions: Sub[]; invoices: Invoice[]; attendance: Attendance[];
};
type Plan = { id: string; name: string; priceMinor: number; durationValue: number; durationUnit: string; active: boolean };

const METHOD_LABELS: Record<string, string> = { cash: "Cash", upi: "UPI", card: "Card", bank_transfer: "Bank", online: "Online" };

export default function AdminMemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [sellOpen, setSellOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const [busy, setBusy] = useState(false);

  const [sell, setSell] = useState({ plan: "", startDate: new Date().toISOString().slice(0, 10), discountPercent: 0, activate: true, createInvoice: true });
  const [pay, setPay] = useState({ amount: "", method: "cash", notes: "" });

  const { data: m, isLoading } = useQuery({
    queryKey: ["admin-member", id],
    queryFn: async () => (await apiGet<{ data: MemberDetail }>(`/api/v1/members/${id}`)).data,
  });
  const { data: plans } = useQuery({
    queryKey: ["admin-plans-active"],
    queryFn: async () => (await apiGet<{ data: Plan[] }>("/api/v1/plans?pageSize=100&all=true")).data,
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["admin-member", id] });
    qc.invalidateQueries({ queryKey: ["admin-members"] });
    qc.invalidateQueries({ queryKey: ["admin-payments"] });
    qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
  }

  async function sellMembership() {
    if (!m) return;
    if (!sell.plan) {
      toast({ title: "Select a plan", description: "Pick the membership plan first.", variant: "error" });
      return;
    }
    setBusy(true);
    try {
      const res = await apiPost<{ data: { subscription: { subscriptionNumber: string }; invoice: { invoiceNumber: string; totalMinor: number } | null } }>(
        "/api/v1/subscriptions",
        {
          member: m.id,
          plan: sell.plan,
          branch: m.branch,
          startDate: new Date(sell.startDate + "T00:00:00"),
          discountPercent: Number(sell.discountPercent) || 0,
          activate: sell.activate,
          createInvoice: sell.createInvoice,
        },
      );
      toast({
        title: "Membership created",
        description: `${res.data.subscription.subscriptionNumber}${res.data.invoice ? ` · invoice ${res.data.invoice.invoiceNumber} for ${money(res.data.invoice.totalMinor)}` : ""}`,
        variant: "success",
      });
      setSellOpen(false);
      refresh();
    } catch (e) {
      toast({ title: "Could not create membership", description: e instanceof ApiClientError ? e.message : "Try again", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function recordPayment() {
    if (!payTarget) return;
    const minor = Math.round(Number(pay.amount) * 100);
    if (!minor || minor < 1) {
      toast({ title: "Invalid amount", description: "Enter the amount in rupees.", variant: "error" });
      return;
    }
    setBusy(true);
    try {
      await apiPost("/api/v1/payments", {
        invoiceId: payTarget.id,
        amountMinor: minor,
        method: pay.method,
        notes: pay.notes,
      });
      toast({ title: "Payment recorded", description: `${money(minor)} received against ${payTarget.invoiceNumber}.`, variant: "success" });
      setPayTarget(null);
      setPay({ amount: "", method: "cash", notes: "" });
      refresh();
    } catch (e) {
      toast({ title: "Payment failed", description: e instanceof ApiClientError ? e.message : "Try again", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !m) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-44 lg:col-span-2" />
          <Skeleton className="h-44" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const fullName = `${m.firstName} ${m.lastName}`.trim();

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/members" className={buttonVariants({ size: "icon", variant: "outline" })} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{fullName}</h1>
            <p className="text-sm text-muted-foreground font-mono">{m.memberNumber}</p>
          </div>
          <Badge variant={statusBadgeVariant(m.status)} className="ml-1">{m.status}</Badge>
        </div>
        <Button onClick={() => setSellOpen(true)}><Plus className="h-4 w-4" /> Sell membership</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Profile */}
        <Card className="border-border bg-card">
          <CardContent className="grid gap-2.5 p-5 text-sm">
            <div className="flex items-center gap-2 text-foreground"><Phone className="h-4 w-4 text-muted-foreground/75" /> {m.phone}</div>
            {m.email && <div className="flex items-center gap-2 text-foreground"><Mail className="h-4 w-4 text-muted-foreground/75" /> {m.email}</div>}
            {m.address && <div className="flex items-center gap-2 text-foreground"><MapPin className="h-4 w-4 text-muted-foreground/75" /> {m.address}</div>}
            <div className="flex items-center gap-2 text-muted-foreground">Joined {fmtDate(m.joinDate)}
              {m.assignedTrainer && <span> · Trainer: {m.assignedTrainer.name}</span>}
            </div>
            {m.goals && <p className="rounded-lg bg-background p-2.5 text-xs text-muted-foreground"><span className="font-semibold text-foreground/75">Goals:</span> {m.goals}</p>}
            {m.healthInfo && <p className="rounded-lg bg-background p-2.5 text-xs text-muted-foreground"><span className="font-semibold text-foreground/75">Health:</span> {m.healthInfo}</p>}
            {m.emergencyContactName && (
              <p className="text-xs text-muted-foreground/75">Emergency: {m.emergencyContactName} · {m.emergencyContactPhone}</p>
            )}
          </CardContent>
        </Card>

        {/* QR */}
        <Card className="border-border bg-card">
          <CardContent className="grid justify-center gap-2 p-5 text-center">
            <p className="flex items-center gap-2 text-sm font-semibold"><QrCode className="h-4 w-4 text-primary" /> Check-in QR</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(m.qrToken)}`}
              alt="Member QR"
              className="mx-auto rounded-lg border border-border bg-white p-1.5"
              width={160}
              height={160}
            />
            <p className="text-xs text-muted-foreground/75">Print or scan at the front desk.</p>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card className="border-border bg-card">
          <CardContent className="grid gap-3 p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground"><Footprints className="h-4 w-4" /> Total check-ins</span>
              <span className="font-bold">{m.attendance.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground"><CreditCard className="h-4 w-4" /> Invoices</span>
              <span className="font-bold">{m.invoices.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground"><CalendarPlus className="h-4 w-4" /> Memberships</span>
              <span className="font-bold">{m.subscriptions.length}</span>
            </div>
            <div className="mt-1 border-t border-border pt-3 text-xs text-muted-foreground/75">
              Last visit: {m.attendance[0] ? fmtDateTime(m.attendance[0].checkInAt) : "never"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Memberships */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Memberships</CardTitle>
          <CardDescription>Subscriptions, expiry and balances</CardDescription>
        </CardHeader>
        <CardContent>
          {m.subscriptions.length === 0 ? (
            <EmptyState
              title="No memberships yet"
              description="Sell the first membership to activate this member."
              action={<Button size="sm" onClick={() => setSellOpen(true)}>Sell membership</Button>}
            />
          ) : (
            <div className="grid gap-2">
              {m.subscriptions.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {s.planSnapshot.name}
                      <span className="ml-2 font-mono text-xs text-muted-foreground/75">{s.subscriptionNumber}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(s.startDate)} → {fmtDate(s.endDate)} · {s.planSnapshot.durationValue} {s.planSnapshot.durationUnit}
                      {s.freezeCount > 0 ? ` · ${s.freezeCount} freeze(s)` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{money(s.totalMinor)}</span>
                    <Badge variant={statusBadgeVariant(s.effectiveStatus)}>{s.effectiveStatus.replace("_", " ")}</Badge>
                    <Badge variant={statusBadgeVariant(s.paymentStatus)}>{s.paymentStatus}</Badge>
                    {Number(s.balanceMinor) > 0 && (
                      <span className="text-xs font-semibold text-amber-600">due {money(s.balanceMinor)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoices & attendance */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Invoices & payments</CardTitle>
            <CardDescription>Record cash / UPI / card collections</CardDescription>
          </CardHeader>
          <CardContent>
            {m.invoices.length === 0 ? (
              <EmptyState title="No invoices" description="Invoices appear when a membership is sold." />
            ) : (
              <div className="grid gap-2">
                {m.invoices.map((inv) => {
                  const balance = inv.totalMinor - inv.paidMinor;
                  return (
                    <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-4 py-3">
                      <div>
                        <p className="text-sm font-medium font-mono">{inv.invoiceNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(inv.issuedAt)} · {money(inv.paidMinor)} of {money(inv.totalMinor)} paid
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusBadgeVariant(inv.status)}>{inv.status}</Badge>
                        {balance > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-amber-300 bg-transparent text-amber-600 hover:bg-amber-50"
                            onClick={() => { setPayTarget(inv); setPay({ amount: (balance / 100).toFixed(2), method: "cash", notes: "" }); }}
                          >
                            Record payment
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent visits</CardTitle>
            <CardDescription>Last {Math.min(m.attendance.length, 10)} check-ins</CardDescription>
          </CardHeader>
          <CardContent>
            {m.attendance.length === 0 ? (
              <EmptyState title="No check-ins yet" description="Visits will appear after the first scan." />
            ) : (
              <div className="grid gap-1.5">
                {m.attendance.slice(0, 10).map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                    <span className="text-foreground/75">{fmtDateTime(a.checkInAt)}</span>
                    <Badge variant="secondary" className="capitalize">{a.method.replace("_", " ")}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sell membership dialog */}
      <Dialog open={sellOpen} onOpenChange={setSellOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sell membership to {fullName}</DialogTitle>
            <DialogDescription>Creates the subscription and (optionally) a payable invoice.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="plan" className="text-xs text-muted-foreground">Plan <span className="text-red-600">*</span></Label>
              <Select id="plan" value={sell.plan} onChange={(e) => setSell((s) => ({ ...s, plan: e.target.value }))} className="border-input bg-background text-foreground">
                <option value="">Select plan...</option>
                {(plans ?? []).filter((p) => p.active).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {money(p.priceMinor)} / {p.durationValue} {p.durationUnit}{p.durationValue > 1 ? "s" : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="startDate" className="text-xs text-muted-foreground">Start date</Label>
                <Input id="startDate" type="date" value={sell.startDate} onChange={(e) => setSell((s) => ({ ...s, startDate: e.target.value }))} className="border-input bg-background text-foreground" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="discount" className="text-xs text-muted-foreground">Discount %</Label>
                <Input id="discount" type="number" min={0} max={100} value={sell.discountPercent} onChange={(e) => setSell((s) => ({ ...s, discountPercent: Number(e.target.value) }))} className="border-input bg-background text-foreground" />
              </div>
            </div>
            <div className="flex flex-wrap gap-5">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground/75">
                <input type="checkbox" className="accent-primary" checked={sell.activate} onChange={(e) => setSell((s) => ({ ...s, activate: e.target.checked }))} />
                Activate immediately
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground/75">
                <input type="checkbox" className="accent-primary" checked={sell.createInvoice} onChange={(e) => setSell((s) => ({ ...s, createInvoice: e.target.checked }))} />
                Create invoice
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-input bg-transparent" onClick={() => setSellOpen(false)}>Cancel</Button>
            <Button onClick={sellMembership} disabled={busy}>{busy ? "Creating..." : "Create membership"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record payment dialog */}
      <Dialog open={!!payTarget} onOpenChange={(v) => !v && setPayTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>{payTarget ? `${payTarget.invoiceNumber} · balance ${money(payTarget.totalMinor - payTarget.paidMinor)}` : ""}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="amt" className="text-xs text-muted-foreground">Amount (₹)</Label>
              <Input id="amt" type="number" min="1" step="0.01" value={pay.amount} onChange={(e) => setPay((p) => ({ ...p, amount: e.target.value }))} className="border-input bg-background text-foreground" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="method" className="text-xs text-muted-foreground">Method</Label>
              <Select id="method" value={pay.method} onChange={(e) => setPay((p) => ({ ...p, method: e.target.value }))} className="border-input bg-background text-foreground">
                {Object.entries(METHOD_LABELS).filter(([k]) => k !== "online").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pnotes" className="text-xs text-muted-foreground">Notes</Label>
              <Input id="pnotes" value={pay.notes} onChange={(e) => setPay((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional" className="border-input bg-background text-foreground" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-input bg-transparent" onClick={() => setPayTarget(null)}>Cancel</Button>
            <Button onClick={recordPayment} disabled={busy}>{busy ? "Saving..." : "Record payment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
