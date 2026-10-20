"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import { apiGet, money, fmtDateTime, statusBadgeVariant } from "@/lib/client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Skeleton, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import Link from "next/link";

type PaymentRow = {
  id: string; paymentNumber: string; amountMinor: number; method: string;
  status: string; paidAt: string | null; notes: string; invoice: string;
  member: { _id?: string; memberNumber?: string; firstName?: string; lastName?: string } | string;
};

const METHODS = ["all", "cash", "upi", "card", "bank_transfer", "online"] as const;
const METHOD_LABELS: Record<string, string> = { cash: "Cash", upi: "UPI", card: "Card", bank_transfer: "Bank", online: "Online" };

export default function AdminPaymentsPage() {
  const [method, setMethod] = useState<(typeof METHODS)[number]>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-payments", method, from, to, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (method !== "all") params.set("method", method);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      return (await apiGet<{ data: PaymentRow[]; meta: { total: number; totalPages: number } }>(`/api/v1/payments?${params}`));
    },
  });

  const rows = data?.data ?? [];
  const pageTotal = rows.reduce((sum, r) => sum + r.amountMinor, 0);
  const totalPages = data?.meta.totalPages ?? 1;

  const memberName = (m: PaymentRow["member"]) =>
    typeof m === "string" ? m : `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim() || m.memberNumber || "—";

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="text-sm text-muted-foreground">All recorded collections — cash, UPI, card and gateway settlements.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {METHODS.map((m) => (
          <button
            key={m}
            onClick={() => { setMethod(m); setPage(1); }}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              method === m ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/75 hover:bg-muted"
            }`}
          >
            {m === "all" ? "All methods" : METHOD_LABELS[m]}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <Label htmlFor="from" className="text-[11px] text-muted-foreground/75">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-8 border-input bg-card text-foreground" />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="to" className="text-[11px] text-muted-foreground/75">To</Label>
            <Input id="to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-8 border-input bg-card text-foreground" />
          </div>
          {(from || to) && (
            <Button size="sm" variant="outline" className="h-8 border-input bg-transparent" onClick={() => { setFrom(""); setTo(""); setPage(1); }}>
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
          <Wallet className="h-4 w-4 text-emerald-600" />
          <span className="text-sm text-muted-foreground">Filtered total</span>
          <span className="font-bold">{money(pageTotal)}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
          <span className="text-sm text-muted-foreground">Payments</span>
          <span className="font-bold">{data?.meta.total ?? 0}</span>
        </div>
        {(from || to) && <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">
          {from ? fmtDateTime(from) : "Start"} → {to ? fmtDateTime(to) : "now"}
        </div>}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Payment</TableHead>
              <TableHead className="text-muted-foreground">Member</TableHead>
              <TableHead className="text-muted-foreground">Paid at</TableHead>
              <TableHead className="text-muted-foreground">Method</TableHead>
              <TableHead className="text-right text-muted-foreground">Amount</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i} className="border-border">
                {Array.from({ length: 6 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
              </TableRow>
            ))}
            {!isLoading && rows.length === 0 && (
              <TableRow className="border-border hover:bg-transparent">
                <TableCell colSpan={6}>
                  <EmptyState title="No payments" description={method !== "all" || from || to ? "No payments match these filters." : "Payments appear once invoices are paid."} />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && rows.map((r) => (
              <TableRow key={r.id} className="border-border">
                <TableCell className="font-mono text-xs text-muted-foreground">{r.paymentNumber}</TableCell>
                <TableCell className="font-medium">
                  {typeof r.member === "object" && r.member?.memberNumber ? (
                    <>
                      <Link href={`/admin/members/${r.member._id}`} className="hover:text-primary">
                        {memberName(r.member)}
                      </Link>
                      <span className="block font-mono text-xs text-muted-foreground/75">{r.member.memberNumber}</span>
                    </>
                  ) : memberName(r.member)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{r.paidAt ? fmtDateTime(r.paidAt) : "—"}</TableCell>
                <TableCell><Badge variant="secondary">{METHOD_LABELS[r.method] ?? r.method}</Badge></TableCell>
                <TableCell className="text-right font-semibold">{money(r.amountMinor)}</TableCell>
                <TableCell><Badge variant={statusBadgeVariant(r.status)}>{r.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground/75">Page {page} of {totalPages}</p>
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

      <div className="flex items-center gap-2 text-xs text-muted-foreground/75">
        <Search className="h-3.5 w-3.5" />
        Need to record a new payment? Open the member from the Members page and use “Record payment”.
      </div>
    </div>
  );
}
