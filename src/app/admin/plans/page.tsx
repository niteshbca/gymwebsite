"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Archive, Search } from "lucide-react";
import { apiGet, apiPost, apiPatch, apiDelete, money, statusBadgeVariant, ApiClientError } from "@/lib/client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Skeleton, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

type Plan = {
  id: string; name: string; code: string; category: string; description: string;
  durationValue: number; durationUnit: string; priceMinor: number; taxPercent: number;
  taxInclusive: boolean; joiningFeeMinor: number; discountEligible: boolean;
  classAccess: string; freezeAllowed: boolean; maxFreezes: number; freezeDaysMax: number;
  active: boolean; archived: boolean; includedSessions: number; guestPasses: number;
};

const EMPTY = {
  name: "", code: "", category: "membership", description: "",
  price: "", taxPercent: 18, taxInclusive: false, joiningFee: "",
  durationValue: 1, durationUnit: "month", classAccess: "group",
  freezeAllowed: true, maxFreezes: 2, freezeDaysMax: 30, active: true,
};

const CATEGORIES = [
  { value: "membership", label: "Membership" },
  { value: "personal_training", label: "Personal training" },
  { value: "class_package", label: "Class package" },
  { value: "one_time", label: "One time" },
];

export default function AdminPlansPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-plans", q],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "100", all: "true" });
      if (q) params.set("q", q);
      return (await apiGet<{ data: Plan[] }>(`/api/v1/plans?${params}`)).data;
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(p: Plan) {
    setEditing(p);
    setForm({
      name: p.name,
      code: p.code,
      category: p.category,
      description: p.description,
      price: (p.priceMinor / 100).toString(),
      taxPercent: p.taxPercent,
      taxInclusive: p.taxInclusive,
      joiningFee: (p.joiningFeeMinor / 100).toString(),
      durationValue: p.durationValue,
      durationUnit: p.durationUnit,
      classAccess: p.classAccess,
      freezeAllowed: p.freezeAllowed,
      maxFreezes: p.maxFreezes,
      freezeDaysMax: p.freezeDaysMax,
      active: p.active,
    });
    setOpen(true);
  }

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    if (!form.name.trim() || !form.price) {
      toast({ title: "Missing details", description: "Name and price are required.", variant: "error" });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        priceMinor: Math.round(Number(form.price) * 100),
        taxPercent: Number(form.taxPercent),
        taxInclusive: form.taxInclusive,
        joiningFeeMinor: Math.round(Number(form.joiningFee) * 100),
        durationValue: Number(form.durationValue),
        durationUnit: form.durationUnit,
        classAccess: form.classAccess,
        freezeAllowed: form.freezeAllowed,
        maxFreezes: Number(form.maxFreezes),
        freezeDaysMax: Number(form.freezeDaysMax),
        active: form.active,
      };
      if (editing) {
        await apiPatch(`/api/v1/plans/${editing.id}`, payload);
        toast({ title: "Plan updated", description: `${form.name} saved. Existing subscriptions keep their price snapshot.`, variant: "success" });
      } else {
        await apiPost("/api/v1/plans", { ...payload, code: form.code.toUpperCase(), category: form.category });
        toast({ title: "Plan created", description: `${form.name} is now sellable.`, variant: "success" });
      }
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
      qc.invalidateQueries({ queryKey: ["admin-plans-active"] });
    } catch (e) {
      toast({ title: editing ? "Update failed" : "Creation failed", description: e instanceof ApiClientError ? e.message : "Try again", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function archive(p: Plan) {
    setBusy(true);
    try {
      await apiDelete(`/api/v1/plans/${p.id}`);
      toast({ title: "Plan archived", description: `${p.name} is hidden from new sales.`, variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
      qc.invalidateQueries({ queryKey: ["admin-plans-active"] });
    } catch (e) {
      toast({ title: "Failed", description: e instanceof ApiClientError ? e.message : "Try again", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  const filtered = (data ?? []).filter(
    (p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.code.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Membership plans</h1>
          <p className="text-sm text-muted-foreground">Pricing, duration, tax and access rules.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> New plan</Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/75" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search plans..." className="border-input bg-card pl-8 text-foreground placeholder:text-muted-foreground/75" />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Code</TableHead>
              <TableHead className="text-muted-foreground">Plan</TableHead>
              <TableHead className="text-muted-foreground">Duration</TableHead>
              <TableHead className="text-muted-foreground">Price</TableHead>
              <TableHead className="text-muted-foreground">Tax</TableHead>
              <TableHead className="text-muted-foreground">Classes</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i} className="border-border">
                {Array.from({ length: 8 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
              </TableRow>
            ))}
            {!isLoading && filtered.length === 0 && (
              <TableRow className="border-border hover:bg-transparent">
                <TableCell colSpan={8}><EmptyState title="No plans yet" description="Create your first membership plan." /></TableCell>
              </TableRow>
            )}
            {!isLoading && filtered.map((p) => (
              <TableRow key={p.id} className="border-border">
                <TableCell className="font-mono text-xs text-muted-foreground">{p.code}</TableCell>
                <TableCell>
                  <span className="font-medium">{p.name}</span>
                  {p.description && <span className="block max-w-[220px] truncate text-xs text-muted-foreground/75">{p.description}</span>}
                </TableCell>
                <TableCell className="whitespace-nowrap text-foreground/75">{p.durationValue} {p.durationUnit}{p.durationValue > 1 ? "s" : ""}</TableCell>
                <TableCell className="whitespace-nowrap font-semibold">{money(p.priceMinor)}
                  {p.joiningFeeMinor > 0 && <span className="block text-xs font-normal text-muted-foreground/75">+ {money(p.joiningFeeMinor)} joining</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">{p.taxPercent}%{p.taxInclusive ? " incl." : ""}</TableCell>
                <TableCell className="capitalize text-muted-foreground">{p.classAccess}</TableCell>
                <TableCell>
                  {p.archived ? <Badge variant="destructive">archived</Badge> : p.active ? <Badge variant="success">active</Badge> : <Badge variant="secondary">inactive</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-1">
                    <Button size="sm" variant="outline" className="border-input bg-transparent" onClick={() => openEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {!p.archived && (
                      <Button size="sm" variant="outline" className="border-input bg-transparent text-muted-foreground" disabled={busy} onClick={() => archive(p)}>
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "New plan"}</DialogTitle>
            <DialogDescription>Prices are stored in paise; enter rupees below.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="pname" className="text-xs text-muted-foreground">Name <span className="text-red-600">*</span></Label>
                <Input id="pname" value={form.name} onChange={(e) => set("name", e.target.value)} className="border-input bg-background text-foreground" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pcode" className="text-xs text-muted-foreground">Code {!editing && <span className="text-red-600">*</span>}</Label>
                <Input id="pcode" value={form.code} disabled={!!editing} onChange={(e) => set("code", e.target.value)} placeholder="e.g. ANNUAL" className="border-input bg-background text-foreground disabled:opacity-50" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="pprice" className="text-xs text-muted-foreground">Price (₹) <span className="text-red-600">*</span></Label>
                <Input id="pprice" type="number" min="0" value={form.price} onChange={(e) => set("price", e.target.value)} className="border-input bg-background text-foreground" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pdur" className="text-xs text-muted-foreground">Duration</Label>
                <div className="flex gap-2">
                  <Input id="pdur" type="number" min="1" value={form.durationValue} onChange={(e) => set("durationValue", Number(e.target.value))} className="border-input bg-background text-foreground" />
                  <Select value={form.durationUnit} onChange={(e) => set("durationUnit", e.target.value)} className="border-input bg-background text-foreground">
                    {["day", "week", "month", "year"].map((u) => <option key={u} value={u}>{u}</option>)}
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pjoin" className="text-xs text-muted-foreground">Joining fee (₹)</Label>
                <Input id="pjoin" type="number" min="0" value={form.joiningFee} onChange={(e) => set("joiningFee", e.target.value)} className="border-input bg-background text-foreground" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ptax" className="text-xs text-muted-foreground">Tax %</Label>
                <Input id="ptax" type="number" min="0" max="100" value={form.taxPercent} onChange={(e) => set("taxPercent", Number(e.target.value))} className="border-input bg-background text-foreground" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pclass" className="text-xs text-muted-foreground">Class access</Label>
                <Select id="pclass" value={form.classAccess} onChange={(e) => set("classAccess", e.target.value)} className="border-input bg-background text-foreground">
                  <option value="none">None</option>
                  <option value="group">Group classes</option>
                  <option value="all">All classes</option>
                </Select>
              </div>
              {!editing && (
                <div className="grid gap-1.5">
                  <Label htmlFor="pcat" className="text-xs text-muted-foreground">Category</Label>
                  <Select id="pcat" value={form.category} onChange={(e) => set("category", e.target.value)} className="border-input bg-background text-foreground">
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </Select>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-5 rounded-lg border border-border p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground/75">
                <input type="checkbox" className="accent-primary" checked={form.taxInclusive} onChange={(e) => set("taxInclusive", e.target.checked)} />
                Tax inclusive
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground/75">
                <input type="checkbox" className="accent-primary" checked={form.freezeAllowed} onChange={(e) => set("freezeAllowed", e.target.checked)} />
                Freezes allowed
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground/75">
                <input type="checkbox" className="accent-primary" checked={form.active} onChange={(e) => set("active", e.target.checked)} />
                Active (sellable)
              </label>
            </div>

            {form.freezeAllowed && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="pfrz" className="text-xs text-muted-foreground">Max freezes</Label>
                  <Input id="pfrz" type="number" min="0" value={form.maxFreezes} onChange={(e) => set("maxFreezes", Number(e.target.value))} className="border-input bg-background text-foreground" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="pfrzd" className="text-xs text-muted-foreground">Max freeze days</Label>
                  <Input id="pfrzd" type="number" min="0" value={form.freezeDaysMax} onChange={(e) => set("freezeDaysMax", Number(e.target.value))} className="border-input bg-background text-foreground" />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-input bg-transparent" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? "Saving..." : editing ? "Save changes" : "Create plan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
