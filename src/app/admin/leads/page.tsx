"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Phone, CalendarClock } from "lucide-react";
import { apiGet, apiPatch, fmtDate, statusBadgeVariant, ApiClientError } from "@/lib/client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Skeleton, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

type Lead = {
  id: string; name: string; phone: string; email: string; source: string;
  status: string; followUpDate: string | null; notes: string; lostReason: string;
  interestedPlan: { name: string; priceMinor: number } | null;
  createdAt: string;
};

const STATUSES = ["new", "contacted", "trial", "negotiation", "converted", "lost"] as const;

export default function AdminLeadsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-leads", status, search],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "100" });
      if (status !== "all") params.set("status", status);
      if (search) params.set("q", search);
      return (await apiGet<{ data: Lead[]; meta: { total: number } }>(`/api/v1/leads?${params}`));
    },
  });

  async function changeStatus(id: string, next: string) {
    let lostReason: string | undefined;
    if (next === "lost") {
      const reason = window.prompt("Why is this lead lost? (optional, cancel to abort)");
      if (reason === null) return;
      lostReason = reason || undefined;
    }
    setBusy(id);
    try {
      await apiPatch("/api/v1/leads", { id, status: next, ...(lostReason ? { lostReason } : {}) });
      toast({ title: "Lead updated", description: `Status moved to ${next}.`, variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin-leads"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    } catch (e) {
      toast({ title: "Update failed", description: e instanceof ApiClientError ? e.message : "Try again", variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  const rows = data?.data ?? [];

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Enquiries & leads</h1>
        <p className="text-sm text-zinc-400">Website forms and walk-in enquiries — move them along the pipeline.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {["all", ...STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors ${
              status === s ? "bg-primary text-primary-foreground" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            {s}
          </button>
        ))}
        <form
          className="ml-auto flex w-full max-w-xs items-center gap-2 sm:w-auto"
          onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, phone, email..."
              className="border-zinc-700 bg-zinc-900 pl-8 text-zinc-100 placeholder:text-zinc-500"
            />
          </div>
          <Button type="submit" size="sm" variant="outline" className="border-zinc-700 bg-transparent">Search</Button>
        </form>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-400">Lead</TableHead>
              <TableHead className="text-zinc-400">Interested in</TableHead>
              <TableHead className="text-zinc-400">Source</TableHead>
              <TableHead className="text-zinc-400">Follow-up</TableHead>
              <TableHead className="text-zinc-400">Status</TableHead>
              <TableHead className="text-zinc-400">Move to</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i} className="border-zinc-800">
                {Array.from({ length: 6 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
              </TableRow>
            ))}
            {!isLoading && rows.length === 0 && (
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableCell colSpan={6}><EmptyState title="No leads" description="Website enquiries will land here automatically." /></TableCell>
              </TableRow>
            )}
            {!isLoading && rows.map((l) => (
              <TableRow key={l.id} className="border-zinc-800">
                <TableCell>
                  <span className="font-medium">{l.name}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-zinc-400">
                    <Phone className="h-3 w-3" /> {l.phone}
                    {l.email && <span className="text-zinc-500">· {l.email}</span>}
                  </span>
                </TableCell>
                <TableCell className="text-zinc-300">
                  {l.interestedPlan ? (
                    <>
                      {l.interestedPlan.name}
                    </>
                  ) : (
                    <span className="text-zinc-500">—</span>
                  )}
                </TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{l.source.replace("_", " ")}</Badge></TableCell>
                <TableCell className="whitespace-nowrap text-zinc-400">
                  {l.followUpDate ? (
                    <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {fmtDate(l.followUpDate)}</span>
                  ) : "—"}
                </TableCell>
                <TableCell><Badge variant={statusBadgeVariant(l.status)} className="capitalize">{l.status}</Badge></TableCell>
                <TableCell>
                  <Select
                    value={l.status}
                    disabled={busy === l.id}
                    onChange={(e) => e.target.value !== l.status && changeStatus(l.id, e.target.value)}
                    className="h-8 w-36 border-zinc-700 bg-zinc-950 text-xs text-zinc-100"
                  >
                    {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-zinc-500">{data?.meta.total ?? 0} lead(s) total</p>
    </div>
  );
}
