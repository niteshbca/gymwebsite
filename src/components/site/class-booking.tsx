"use client";

import { useState } from "react";
import { CalendarCheck2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { apiPost, ApiClientError } from "@/lib/client";

type ClassInfo = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  room: string;
  nextDate: string;
};

export function ClassBookingDialog({
  gymName,
  cls,
  open,
  onOpenChange,
}: {
  gymName: string;
  cls: ClassInfo | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(cls?.nextDate ?? "");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ when: string; message: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cls) return;
    setLoading(true);
    try {
      const res = await apiPost<{ data: { when: string; message: string } }>("/api/v1/public/bookings", {
        classId: cls.id,
        occurrenceDate: date,
        name,
        email,
        phone,
        notes,
      });
      setDone({ when: res.data.when, message: res.data.message });
      toast({ title: "Booking request sent!", description: "Check your email for updates.", variant: "success" });
    } catch (err) {
      toast({
        title: "Could not book",
        description: err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  function reset(v: boolean) {
    onOpenChange(v);
    if (!v) setTimeout(() => setDone(null), 200);
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent>
        {!done ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><CalendarCheck2 className="h-5 w-5 text-primary" /> Book {cls?.name}</DialogTitle>
              <DialogDescription>
                {cls ? `${cls.startTime} – ${cls.endTime} · ${cls.room} · ${gymName}` : ""} — your request is confirmed by the gym team via email.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="bk-name">Full name</Label>
                <Input id="bk-name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul Sharma" />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="bk-email">Email</Label>
                  <Input id="bk-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bk-phone">Phone</Label>
                  <Input id="bk-phone" type="tel" required minLength={8} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bk-date">Session date</Label>
                <Input
                  id="bk-date"
                  type="date"
                  required
                  value={date}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">This class runs every week. Pick the date you want to attend.</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bk-notes">Notes (optional)</Label>
                <Input id="bk-notes" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="First visit, any injuries, etc." />
              </div>
              <Button type="submit" disabled={loading}>{loading ? "Sending..." : "Request booking"}</Button>
              <p className="text-xs text-muted-foreground">By requesting you agree to the gym rules. No payment is taken online.</p>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <DialogTitle>Request received!</DialogTitle>
            <p className="text-sm text-muted-foreground">{done.message}</p>
            <div className="mt-2 w-full rounded-lg border border-dashed border-emerald-400 bg-emerald-50 p-4 text-left text-sm dark:bg-emerald-950/40">
              <p className="font-semibold">{cls?.name}</p>
              <p className="text-muted-foreground">{done.when} · {cls?.room}</p>
            </div>
            <Button variant="outline" onClick={() => reset(false)}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function nextWeekdayDates(dayOfWeek: number, count = 6): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const fmt = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  while (out.length < count) {
    if (d.getDay() === dayOfWeek) out.push(fmt(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}
