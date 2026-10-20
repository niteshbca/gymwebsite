"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Search, Mail, Phone, RefreshCw } from "lucide-react";
import { apiGet, apiPatch, fmtDate, statusBadgeVariant, ApiClientError } from "@/lib/client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Skeleton, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

type BookingRow = {
  id: string; status: string; source: string; passCode: string;
  guestName: string; guestEmail: string; guestPhone: string; notes: string; rejectReason: string;
  occurrenceDate: string; bookedAt: string; reviewedAt: string | null;
  className: string; startTime: string; endTime: string; room: string; memberNumber: string;
};

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "booked", label: "Approved" },
  { key: "waitlisted", label: "Waitlist" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
] as const;

export default function AdminBookingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("pending");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [rejectTarget, setRejectTarget] = useState<BookingRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-bookings", tab, search],
    queryFn: async () => {
      const params = new URLSearchParams({ status: tab, pageSize: "100" });
      if (search) params.set("q", search);
      return (await apiGet<{ data: BookingRow[]; meta: { total: number } }>(`/api/v1/bookings?${params}`)).data;
    },
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["admin-bookings"] });
    qc.invalidateQueries({ queryKey: ["admin-bookings-pending"] });
    refetch();
  }

  async function approve(b: BookingRow) {
    setBusy(b.id);
    try {
      const res = await apiPatch<{ data: { status: string; passCode: string } }>(`/api/v1/bookings/${b.id}`, { action: "approve" });
      toast({
        title: res.data.status === "waitlisted" ? "Approved to waitlist" : "Booking approved",
        description: res.data.status === "waitlisted" ? "Class was full — customer added to waitlist." : `Pass ${res.data.passCode} emailed to ${b.guestName}.`,
        variant: "success",
      });
      refresh();
    } catch (e) {
      toast({ title: "Approval failed", description: e instanceof ApiClientError ? e.message : "Try again", variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    if (!rejectTarget) return;
    setBusy(rejectTarget.id);
    try {
      await apiPatch(`/api/v1/bookings/${rejectTarget.id}`, { action: "reject", reason });
      toast({ title: "Booking rejected", description: `Customer has been emailed${reason ? " with the reason" : ""}.`, variant: "success" });
      setRejectTarget(null);
      setReason("");
      refresh();
    } catch (e) {
      toast({ title: "Failed", description: e instanceof ApiClientError ? e.message : "Try again", variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Class bookings</h1>
          <p className="text-sm text-muted-foreground">Website booking requests — approve to send the customer their digital pass.</p>
        </div>
        <Button variant="outline" size="sm" className="border-input bg-transparent" onClick={refresh}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/75 hover:bg-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
        <form
          className="ml-auto flex w-full max-w-xs items-center gap-2 sm:w-auto"
          onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/75" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, pass code..."
              className="h-9 border-input bg-card pl-8 text-sm"
            />
          </div>
          <Button type="submit" size="sm" variant="outline" className="border-input bg-transparent">Search</Button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="p-4"><Skeleton className="h-64" /></div>
        ) : !data || data.length === 0 ? (
          <EmptyState title={tab === "pending" ? "No pending requests" : "Nothing here"} description={tab === "pending" ? "New website bookings will appear here for approval." : "Try another filter."} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Customer</TableHead>
                <TableHead className="text-muted-foreground">Class</TableHead>
                <TableHead className="text-muted-foreground">Session</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Pass</TableHead>
                <TableHead className="text-right text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((b) => (
                <TableRow key={b.id} className="border-border">
                  <TableCell>
                    <p className="font-medium">{b.guestName}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" />{b.guestEmail || "—"}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{b.guestPhone || "—"}</p>
                    {b.memberNumber && <p className="text-xs text-muted-foreground/75">Member #{b.memberNumber}</p>}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{b.className}</p>
                    <p className="text-xs text-muted-foreground">{b.startTime}–{b.endTime} · {b.room}</p>
                    {b.source === "website" && <Badge variant="info" className="mt-1">Website</Badge>}
                  </TableCell>
                  <TableCell className="text-sm">{fmtDate(b.occurrenceDate)}</TableCell>
                  <TableCell><Badge variant={statusBadgeVariant(b.status)}>{b.status}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{b.passCode || "—"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {b.status === "pending" || b.status === "waitlisted" ? (
                        <>
                          <Button size="sm" disabled={busy === b.id} onClick={() => approve(b)}>
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive" disabled={busy === b.id} onClick={() => setRejectTarget(b)}>
                            <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground/75">{b.status === "rejected" ? b.rejectReason || "Rejected" : b.status === "booked" ? "Confirmed" : "—"}</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!rejectTarget} onOpenChange={(v) => { if (!v) { setRejectTarget(null); setReason(""); } }}>
        <DialogContent className="border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle>Reject booking</DialogTitle>
            <DialogDescription>
              {rejectTarget ? `${rejectTarget.guestName} — ${rejectTarget.className}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <label htmlFor="reject-reason" className="text-sm font-medium">Reason (shared with the customer)</label>
            <Input
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Session cancelled / class full"
              className="border-input bg-background"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-input bg-transparent" onClick={() => { setRejectTarget(null); setReason(""); }}>Cancel</Button>
            <Button variant="destructive" disabled={busy === rejectTarget?.id} onClick={reject}>
              {busy === rejectTarget?.id ? "Rejecting..." : "Reject & notify"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
