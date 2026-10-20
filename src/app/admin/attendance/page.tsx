"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScanLine, RefreshCw, LogOut, CheckCircle2, XCircle } from "lucide-react";
import { apiGet, apiPost, fmtDateTime, ApiClientError } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Skeleton, EmptyState } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

type AttRow = {
  id: string; checkInAt: string; checkOutAt: string | null; method: string;
  member: { _id?: string; memberNumber?: string; firstName?: string; lastName?: string } | null;
};

type CheckinResult =
  | { ok: true; name: string; memberNumber: string; method: string; time: string }
  | { ok: false; message: string };

export default function AdminAttendancePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [number, setNumber] = useState("");
  const [method, setMethod] = useState("reception");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-attendance"],
    queryFn: async () => (await apiGet<{ data: AttRow[]; meta: { total: number } }>("/api/v1/attendance?pageSize=100")),
  });

  async function checkin(e: React.FormEvent) {
    e.preventDefault();
    if (!number.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await apiPost<{ data: { member: { memberNumber: string; firstName: string; lastName: string }; checkInAt: string; method: string } }>(
        "/api/v1/attendance",
        { memberNumber: number.trim(), method },
      );
      setResult({
        ok: true,
        name: `${res.data.member.firstName} ${res.data.member.lastName}`.trim(),
        memberNumber: res.data.member.memberNumber,
        method: res.data.method,
        time: fmtDateTime(res.data.checkInAt),
      });
      setNumber("");
      qc.invalidateQueries({ queryKey: ["admin-attendance"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Check-in failed";
      setResult({ ok: false, message });
      toast({ title: "Check-in refused", description: message, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function checkout(row: AttRow) {
    const memberId = typeof row.member === "object" ? row.member?._id : undefined;
    if (!memberId) return;
    try {
      await apiPost("/api/v1/attendance/checkout", { memberId });
      toast({ title: "Checked out", description: "Visit duration recorded.", variant: "success" });
      refetch();
    } catch (err) {
      toast({ title: "Checkout failed", description: err instanceof ApiClientError ? err.message : "Try again", variant: "error" });
    }
  }

  const rows = data?.data ?? [];

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-sm text-zinc-400">Front-desk check-ins and today’s visit log.</p>
        </div>
        <Button size="sm" variant="outline" className="border-zinc-700 bg-transparent" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><ScanLine className="h-4 w-4 text-primary" /> Quick check-in</CardTitle>
            <CardDescription>Type or scan the member number (FIT#####).</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={checkin} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="mno" className="text-xs text-zinc-400">Member number</Label>
                <Input
                  id="mno"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="FIT00001"
                  autoFocus
                  className="border-zinc-700 bg-zinc-950 font-mono text-zinc-100 placeholder:text-zinc-600"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="method" className="text-xs text-zinc-400">Method</Label>
                <Select id="method" value={method} onChange={(e) => setMethod(e.target.value)} className="border-zinc-700 bg-zinc-950 text-zinc-100">
                  <option value="reception">Reception (desk)</option>
                  <option value="manual">Manual (staff assist)</option>
                  <option value="member_id">Member ID card</option>
                </Select>
              </div>
              <Button type="submit" disabled={busy || !number.trim()}>
                {busy ? "Checking..." : "Check in member"}
              </Button>

              {result && (
                <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                  result.ok ? "border-emerald-800 bg-emerald-950 text-emerald-200" : "border-red-800 bg-red-950 text-red-200"
                }`}>
                  {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                  {result.ok ? (
                    <div>
                      <p className="font-semibold">{result.name} checked in</p>
                      <p className="text-xs opacity-80">{result.memberNumber} · {result.time} · {result.method}</p>
                    </div>
                  ) : (
                    <p>{result.message}</p>
                  )}
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Today’s visits</CardTitle>
            <CardDescription>{data?.meta.total ?? 0} check-ins recorded today</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid gap-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : rows.length === 0 ? (
              <EmptyState title="No check-ins today" description="Scan a member number to record the first visit." />
            ) : (
              <div className="rounded-lg border border-zinc-800">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-zinc-400">Member</TableHead>
                      <TableHead className="text-zinc-400">Check-in</TableHead>
                      <TableHead className="text-zinc-400">Check-out</TableHead>
                      <TableHead className="text-zinc-400">Method</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const mem = typeof r.member === "object" ? r.member : null;
                      return (
                        <TableRow key={r.id} className="border-zinc-800">
                          <TableCell>
                            <span className="font-medium">{mem ? `${mem.firstName ?? ""} ${mem.lastName ?? ""}`.trim() || mem.memberNumber : "—"}</span>
                            {mem?.memberNumber && <span className="block font-mono text-xs text-zinc-500">{mem.memberNumber}</span>}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-zinc-300">{fmtDateTime(r.checkInAt)}</TableCell>
                          <TableCell className="whitespace-nowrap text-zinc-400">{r.checkOutAt ? fmtDateTime(r.checkOutAt) : "—"}</TableCell>
                          <TableCell><Badge variant="secondary" className="capitalize">{r.method.replace("_", " ")}</Badge></TableCell>
                          <TableCell className="text-right">
                            {!r.checkOutAt && mem?._id && (
                              <Button size="sm" variant="outline" className="border-zinc-700 bg-transparent text-zinc-300" onClick={() => checkout(r)}>
                                <LogOut className="h-3.5 w-3.5" /> Check out
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
