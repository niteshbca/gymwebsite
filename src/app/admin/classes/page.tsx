"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Power, Users, Clock } from "lucide-react";
import { apiGet, apiPost, apiPatch, ApiClientError } from "@/lib/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Label, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Skeleton, EmptyState } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type ClassRow = {
  id: string; name: string; description: string; branch: string; room: string;
  capacity: number; waitlistCapacity: number; dayOfWeek: number; startTime: string; endTime: string;
  active: boolean; requiresPlanAccess: boolean; bookingWindowHours: number; cancelCutoffHours: number;
  trainer: { _id?: string; name: string } | null;
};
type Trainer = { id: string; name: string; active?: boolean };

const EMPTY = {
  name: "", description: "", dayOfWeek: 1, startTime: "07:00", endTime: "08:00",
  room: "Main Floor", capacity: 20, waitlistCapacity: 5, trainer: "",
  bookingWindowHours: 48, cancelCutoffHours: 2, requiresPlanAccess: true, branch: "",
};

export default function AdminClassesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["auth-me"],
    queryFn: async () => (await apiGet<{ data: { branch: string | null } }>("/api/v1/auth/me")).data,
    staleTime: 60_000,
  });
  const { data: classes, isLoading } = useQuery({
    queryKey: ["admin-classes"],
    queryFn: async () => (await apiGet<{ data: ClassRow[] }>("/api/v1/classes?pageSize=100")).data,
  });
  const { data: trainers } = useQuery({
    queryKey: ["admin-trainers"],
    queryFn: async () => (await apiGet<{ data: Trainer[] }>("/api/v1/trainers?pageSize=100")).data,
    retry: false,
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY, branch: me?.branch ?? "" });
    setOpen(true);
  }

  function openEdit(c: ClassRow) {
    setEditing(c);
    setForm({
      name: c.name,
      description: c.description,
      dayOfWeek: c.dayOfWeek,
      startTime: c.startTime,
      endTime: c.endTime,
      room: c.room,
      capacity: c.capacity,
      waitlistCapacity: c.waitlistCapacity,
      trainer: c.trainer?._id ?? "",
      bookingWindowHours: c.bookingWindowHours,
      cancelCutoffHours: c.cancelCutoffHours,
      requiresPlanAccess: c.requiresPlanAccess,
      branch: c.branch,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      toast({ title: "Name required", description: "Give the class a name.", variant: "error" });
      return;
    }
    if (form.startTime >= form.endTime) {
      toast({ title: "Invalid timings", description: "End time must be after start time.", variant: "error" });
      return;
    }
    setBusy(true);
    const payload = {
      name: form.name,
      description: form.description,
      dayOfWeek: Number(form.dayOfWeek),
      startTime: form.startTime,
      endTime: form.endTime,
      room: form.room,
      capacity: Number(form.capacity),
      waitlistCapacity: Number(form.waitlistCapacity),
      trainer: form.trainer || null,
      bookingWindowHours: Number(form.bookingWindowHours),
      cancelCutoffHours: Number(form.cancelCutoffHours),
      requiresPlanAccess: form.requiresPlanAccess,
    };
    try {
      if (editing) {
        await apiPatch(`/api/v1/classes/${editing.id}`, payload);
        toast({ title: "Class updated", description: `${form.name} saved.`, variant: "success" });
      } else {
        if (!form.branch) {
          toast({ title: "Select a branch", description: "Classes belong to a branch.", variant: "error" });
          setBusy(false);
          return;
        }
        await apiPost("/api/v1/classes", { ...payload, branch: form.branch });
        toast({ title: "Class created", description: `${form.name} added to the schedule.`, variant: "success" });
      }
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-classes"] });
      qc.invalidateQueries({ queryKey: ["member-classes"] });
    } catch (e) {
      toast({ title: "Failed", description: e instanceof ApiClientError ? e.message : "Try again", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function toggle(c: ClassRow) {
    setBusy(true);
    try {
      if (c.active) {
        await apiPatch(`/api/v1/classes/${c.id}`, { active: false });
        toast({ title: "Class deactivated", description: `${c.name} hidden from booking.`, variant: "success" });
      } else {
        await apiPatch(`/api/v1/classes/${c.id}`, { active: true });
        toast({ title: "Class activated", description: `${c.name} is bookable again.`, variant: "success" });
      }
      qc.invalidateQueries({ queryKey: ["admin-classes"] });
      qc.invalidateQueries({ queryKey: ["member-classes"] });
    } catch (e) {
      toast({ title: "Failed", description: e instanceof ApiClientError ? e.message : "Try again", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Class schedule</h1>
          <p className="text-sm text-zinc-400">Weekly recurring classes — members book seats against capacity.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> New class</Button>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      )}

      {!isLoading && (classes?.length ?? 0) === 0 && (
        <EmptyState title="No classes scheduled" description="Create the first class to open bookings." action={<Button size="sm" onClick={openCreate}>New class</Button>} />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(classes ?? []).map((c) => (
          <Card key={c.id} className="border-zinc-800 bg-zinc-900">
            <CardContent className="grid gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold leading-tight">{c.name}</p>
                <Badge variant={c.active ? "success" : "secondary"}>{c.active ? "active" : "off"}</Badge>
              </div>
              <p className="text-xs text-zinc-400">
                {DAYS[c.dayOfWeek]} · <Clock className="inline h-3 w-3" /> {c.startTime}–{c.endTime} · {c.room}
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {c.capacity} seats (+{c.waitlistCapacity} waitlist)</span>
                {c.requiresPlanAccess && <Badge variant="info">members only</Badge>}
              </div>
              {c.trainer && <p className="text-xs text-zinc-500">Coach: {c.trainer.name}</p>}
              <div className="mt-1 flex gap-2">
                <Button size="sm" variant="outline" className="border-zinc-700 bg-transparent" onClick={() => openEdit(c)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={`border-zinc-700 bg-transparent ${c.active ? "text-zinc-400" : "text-emerald-400"}`}
                  disabled={busy}
                  onClick={() => toggle(c)}
                >
                  <Power className="h-3.5 w-3.5" /> {c.active ? "Turn off" : "Turn on"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "New class"}</DialogTitle>
            <DialogDescription>Repeats weekly on the selected day.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="cname" className="text-xs text-zinc-400">Class name <span className="text-red-400">*</span></Label>
              <Input id="cname" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Morning HIIT" className="border-zinc-700 bg-zinc-950 text-zinc-100" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cdesc" className="text-xs text-zinc-400">Description</Label>
              <Textarea id="cdesc" value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} className="border-zinc-700 bg-zinc-950 text-zinc-100" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cday" className="text-xs text-zinc-400">Day</Label>
                <Select id="cday" value={String(form.dayOfWeek)} onChange={(e) => set("dayOfWeek", Number(e.target.value))} className="border-zinc-700 bg-zinc-950 text-zinc-100">
                  {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cstart" className="text-xs text-zinc-400">Start</Label>
                <Input id="cstart" type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} className="border-zinc-700 bg-zinc-950 text-zinc-100" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cend" className="text-xs text-zinc-400">End</Label>
                <Input id="cend" type="time" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} className="border-zinc-700 bg-zinc-950 text-zinc-100" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="croom" className="text-xs text-zinc-400">Room</Label>
                <Input id="croom" value={form.room} onChange={(e) => set("room", e.target.value)} className="border-zinc-700 bg-zinc-950 text-zinc-100" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ccap" className="text-xs text-zinc-400">Capacity</Label>
                <Input id="ccap" type="number" min="1" value={form.capacity} onChange={(e) => set("capacity", Number(e.target.value))} className="border-zinc-700 bg-zinc-950 text-zinc-100" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cwait" className="text-xs text-zinc-400">Waitlist</Label>
                <Input id="cwait" type="number" min="0" value={form.waitlistCapacity} onChange={(e) => set("waitlistCapacity", Number(e.target.value))} className="border-zinc-700 bg-zinc-950 text-zinc-100" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ctrainer" className="text-xs text-zinc-400">Trainer</Label>
                <Select id="ctrainer" value={form.trainer} onChange={(e) => set("trainer", e.target.value)} className="border-zinc-700 bg-zinc-950 text-zinc-100">
                  <option value="">No trainer</option>
                  {(trainers ?? []).filter((t) => t.active !== false).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cwindow" className="text-xs text-zinc-400">Booking window (h)</Label>
                <Input id="cwindow" type="number" min="1" value={form.bookingWindowHours} onChange={(e) => set("bookingWindowHours", Number(e.target.value))} className="border-zinc-700 bg-zinc-950 text-zinc-100" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ccancel" className="text-xs text-zinc-400">Cancel cutoff (h)</Label>
                <Input id="ccancel" type="number" min="0" value={form.cancelCutoffHours} onChange={(e) => set("cancelCutoffHours", Number(e.target.value))} className="border-zinc-700 bg-zinc-950 text-zinc-100" />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" className="accent-primary" checked={form.requiresPlanAccess} onChange={(e) => set("requiresPlanAccess", e.target.checked)} />
              Require active membership to book
            </label>
            {!editing && !me?.branch && (
              <p className="text-xs text-amber-400">Your account has no branch — assign one to your staff account first.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-zinc-700 bg-transparent" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? "Saving..." : editing ? "Save changes" : "Create class"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
