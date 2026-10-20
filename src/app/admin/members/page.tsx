"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { apiGet, apiPost, fmtDate, statusBadgeVariant, ApiClientError } from "@/lib/client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Skeleton, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

type MemberRow = {
  id: string; memberNumber: string; firstName: string; lastName: string;
  phone: string; email: string; status: string; joinDate: string;
  branch: string; assignedTrainer: { name: string } | null;
};

const STATUSES = ["all", "active", "inactive", "blocked"] as const;

const EMPTY_FORM = {
  firstName: "", lastName: "", phone: "", email: "", address: "",
  branch: "", source: "walk_in", status: "active", notes: "",
};

export default function AdminMembersPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["auth-me"],
    queryFn: async () => (await apiGet<{ data: { branch: string | null; role: string } }>("/api/v1/auth/me")).data,
    staleTime: 60_000,
  });
  const { data: branches } = useQuery({
    queryKey: ["branches-all"],
    queryFn: async () => (await apiGet<{ data: { id: string; name: string }[] }>("/api/v1/branches?pageSize=100")).data,
    enabled: !!me && !me.branch,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-members", search, status, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (search) params.set("q", search);
      if (status !== "all") params.set("status", status);
      return (await apiGet<{ data: MemberRow[]; meta: { total: number; totalPages: number } }>(`/api/v1/members?${params}`));
    },
  });

  async function createMember() {
    if (!form.firstName.trim() || !form.phone.trim()) {
      toast({ title: "Missing details", description: "First name and phone are required.", variant: "error" });
      return;
    }
    const branch = form.branch || me?.branch;
    if (!branch) {
      toast({ title: "Select a branch", description: "Pick the branch this member belongs to.", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      const res = await apiPost<{ data: { memberNumber: string } }>("/api/v1/members", { ...form, branch });
      toast({ title: "Member created", description: `${res.data.memberNumber} is ready. You can now sell them a membership.`, variant: "success" });
      setOpen(false);
      setForm(EMPTY_FORM);
      qc.invalidateQueries({ queryKey: ["admin-members"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    } catch (e) {
      toast({ title: "Could not create member", description: e instanceof ApiClientError ? e.message : "Try again", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  const branchFor = form.branch || me?.branch || "";
  const totalPages = data?.meta.totalPages ?? 1;

  const field = (name: keyof typeof form, label: string, type = "text", required = false) => (
    <div className="grid gap-1.5">
      <Label htmlFor={name} className="text-xs text-muted-foreground">{label}{required && <span className="text-red-600"> *</span>}</Label>
      <Input
        id={name}
        type={type}
        value={form[name]}
        required={required}
        onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
        className="border-input bg-background text-foreground"
      />
    </div>
  );

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Members</h1>
          <p className="text-sm text-muted-foreground">Search members, open a profile to sell memberships or record payments.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New member</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors ${
              status === s ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/75 hover:bg-muted"
            }`}
          >
            {s}
          </button>
        ))}
        <form
          className="ml-auto flex w-full max-w-xs items-center gap-2 sm:w-auto"
          onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); setPage(1); }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/75" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, phone, member no..."
              className="border-input bg-card pl-8 text-foreground placeholder:text-muted-foreground/75"
            />
          </div>
          <Button type="submit" size="sm" variant="outline" className="border-input bg-transparent">Search</Button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Member</TableHead>
              <TableHead className="text-muted-foreground">Contact</TableHead>
              <TableHead className="text-muted-foreground">Joined</TableHead>
              <TableHead className="text-muted-foreground">Trainer</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i} className="border-border">
                {Array.from({ length: 6 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
              </TableRow>
            ))}
            {!isLoading && data?.data.length === 0 && (
              <TableRow className="border-border hover:bg-transparent">
                <TableCell colSpan={6}>
                  <EmptyState title="No members found" description={search ? "Try a different search." : "Create your first member to get started."} />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.data.map((m) => (
              <TableRow key={m.id} className="border-border">
                <TableCell>
                  <Link href={`/admin/members/${m.id}`} className="font-medium text-foreground hover:text-primary">
                    {m.firstName} {m.lastName}
                  </Link>
                  <span className="block font-mono text-xs text-muted-foreground/75">{m.memberNumber}</span>
                </TableCell>
                <TableCell className="text-sm text-foreground/75">
                  {m.phone}
                  {m.email && <span className="block text-xs text-muted-foreground/75">{m.email}</span>}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDate(m.joinDate)}</TableCell>
                <TableCell className="text-muted-foreground">{m.assignedTrainer?.name ?? "—"}</TableCell>
                <TableCell><Badge variant={statusBadgeVariant(m.status)}>{m.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Link href={`/admin/members/${m.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>Open</Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground/75">Page {page} of {totalPages} · {data?.meta.total ?? 0} members</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="border-input bg-transparent" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </Button>
            <Button size="sm" variant="outline" className="border-input bg-transparent" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New member</DialogTitle>
            <DialogDescription>Member number is generated automatically (FIT#####).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {field("firstName", "First name", "text", true)}
              {field("lastName", "Last name")}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("phone", "Phone", "tel", true)}
              {field("email", "Email", "email")}
            </div>
            {field("address", "Address")}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="branch" className="text-xs text-muted-foreground">Branch <span className="text-red-600">*</span></Label>
                <Select id="branch" value={form.branch || branchFor} onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))} className="border-input bg-background text-foreground">
                  {!me?.branch && <option value="">Select branch...</option>}
                  {(branches ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  {me?.branch && !(branches ?? []).some((b) => b.id === me.branch) && <option value={me.branch}>My branch</option>}
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="source" className="text-xs text-muted-foreground">Source</Label>
                <Select id="source" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} className="border-input bg-background text-foreground">
                  <option value="walk_in">Walk-in</option>
                  <option value="website">Website</option>
                  <option value="referral">Referral</option>
                  <option value="phone">Phone</option>
                  <option value="campaign">Campaign</option>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="mstatus" className="text-xs text-muted-foreground">Status</Label>
                <Select id="mstatus" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="border-input bg-background text-foreground">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="blocked">Blocked</option>
                </Select>
              </div>
            </div>
            {!me?.branch && (branches?.length ?? 0) === 0 && (
              <p className="text-xs text-amber-600">No branches found — create a branch first.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-input bg-transparent" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={createMember} disabled={saving}>{saving ? "Creating..." : "Create member"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
