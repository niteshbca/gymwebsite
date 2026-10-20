"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { XCircle, RefreshCw, QrCode } from "lucide-react";
import { apiGet, apiPost, fmtDate, statusBadgeVariant, ApiClientError } from "@/lib/client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Skeleton, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import Link from "next/link";

type BookingRow = {
  id: string; status: string; occurrenceDate: string; passCode: string; rejectReason: string;
  bookedAt: string;
  class: { name: string; startTime: string; endTime: string; room: string; trainer: string; capacity: number } | null;
};

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
] as const;

export default function MemberBookingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("upcoming");
  const [cancelTarget, setCancelTarget] = useState<BookingRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["member-bookings", tab],
    queryFn: async () => (await apiGet<{ data: BookingRow[] }>(`/api/v1/member/bookings?view=${tab}&pageSize=100`)).data,
  });

  async function cancelBooking() {
    if (!cancelTarget) return;
    setBusy(cancelTarget.id);
    try {
      await apiPost("/api/v1/classes/bookings/cancel", { bookingId: cancelTarget.id });
      toast({ title: "Booking cancelled", description: "Your seat has been released.", variant: "success" });
      setCancelTarget(null);
      qc.invalidateQueries({ queryKey: ["member-bookings"] });
      qc.invalidateQueries({ queryKey: ["member-me"] });
    } catch (e) {
      toast({ title: "Could not cancel", description: e instanceof ApiClientError ? e.message : "Try again", variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">My bookings</h1>
          <p className="text-sm text-zinc-400">Cancel a session or show your pass code at the desk.</p>
        </div>
        <Link href="/member/book" className={buttonVariants({ size: "sm" })}>Book a new class</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              tab === t.key ? "bg-primary text-primary-foreground" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-400">Date</TableHead>
              <TableHead className="text-zinc-400">Class</TableHead>
              <TableHead className="text-zinc-400">Time</TableHead>
              <TableHead className="text-zinc-400">Room</TableHead>
              <TableHead className="text-zinc-400">Pass</TableHead>
              <TableHead className="text-zinc-400">Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <>
                {Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i} className="border-zinc-800">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))}
              </>
            )}
            {!isLoading && data?.length === 0 && (
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableCell colSpan={7}>
                  <EmptyState
                    title={tab === "past" ? "No past bookings" : "No upcoming bookings"}
                    description="Pick a class from the schedule to get going."
                    action={<Link href="/member/book" className={buttonVariants({ size: "sm" })}>Browse schedule</Link>}
                  />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.map((b) => {
              const d = new Date(b.occurrenceDate);
              const canCancel = tab !== "past" && ["booked", "waitlisted"].includes(b.status);
              return (
                <TableRow key={b.id} className="border-zinc-800">
                  <TableCell className="whitespace-nowrap text-zinc-200">
                    {fmtDate(b.occurrenceDate)}
                    <span className="ml-2 text-xs text-zinc-500">
                      {d.toLocaleDateString("en-IN", { weekday: "short" })}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{b.class?.name ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-zinc-300">
                    {b.class ? `${b.class.startTime}–${b.class.endTime}` : "—"}
                  </TableCell>
                  <TableCell className="text-zinc-400">
                    {b.class?.room ?? "—"}
                    {b.class?.trainer ? <span className="block text-xs text-zinc-500">{b.class.trainer}</span> : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-zinc-400">{b.passCode || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(b.status)}>{b.status}</Badge>
                    {b.status === "rejected" && b.rejectReason && (
                      <p className="mt-1 max-w-[160px] text-xs text-zinc-500">{b.rejectReason}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {canCancel && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-900 bg-transparent text-red-400 hover:bg-red-950 hover:text-red-300"
                        disabled={busy === b.id}
                        onClick={() => setCancelTarget(b)}
                      >
                        <XCircle className="h-3.5 w-3.5" /> Cancel
                      </Button>
                    )}
                    {!canCancel && b.status === "attended" && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                        <QrCode className="h-3.5 w-3.5" /> Used
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!cancelTarget} onOpenChange={(v) => !v && setCancelTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this booking?</DialogTitle>
            <DialogDescription>
              {cancelTarget ? `${cancelTarget.class?.name ?? "Class"} on ${fmtDate(cancelTarget.occurrenceDate)} at ${cancelTarget.class?.startTime}` : ""}
              . Your seat will be offered to the waitlist.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="border-zinc-700 bg-transparent" onClick={() => setCancelTarget(null)}>Keep booking</Button>
            <Button variant="destructive" disabled={busy === cancelTarget?.id} onClick={cancelBooking}>
              {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Yes, cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
