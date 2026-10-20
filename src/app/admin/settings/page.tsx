"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Plus, Trash2, Loader2 } from "lucide-react";
import { apiGet, apiPatch, ApiClientError } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

type Settings = {
  gymName: string; tagline: string; logoUrl: string;
  address: string; city: string; phone: string; email: string; website: string; mapLink: string;
  social: { facebook: string; instagram: string; youtube: string; twitter: string };
  currency: string; timezone: string; taxLabel: string; taxPercentDefault: number;
  invoicePrefix: string; receiptFooter: string;
  hero: { title: string; subtitle: string; ctaText: string; imageUrl: string };
  openingHours: { day: string; open: string; close: string; closed: boolean }[];
  facilities: { title: string; description: string; icon: string }[];
  testimonials: { name: string; quote: string; rating: number }[];
  faqs: { question: string; answer: string }[];
  gallery: { url: string; caption: string }[];
  membershipPolicy: string; cancellationPolicy: string; refundPolicy: string;
  privacyPolicy: string; terms: string;
  expiryReminderWindowsDays: number[];
  allowPartialPayments: boolean; allowSelfRegistration: boolean; themePrimary: string;
};

const TABS = [
  { key: "general", label: "General" },
  { key: "contact", label: "Contact & social" },
  { key: "hero", label: "Homepage hero" },
  { key: "hours", label: "Opening hours" },
  { key: "content", label: "Facilities & FAQs" },
  { key: "socialproof", label: "Testimonials & gallery" },
  { key: "policies", label: "Policies" },
  { key: "ops", label: "Operations" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("general");
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const data = (await apiGet<{ data: Settings }>("/api/v1/settings")).data;
      setS(data);
      return data;
    },
  });

  const u = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => (p ? { ...p, [k]: v } : p));
  const uHero = <K extends keyof Settings["hero"]>(k: K, v: Settings["hero"][K]) =>
    setS((p) => (p ? { ...p, hero: { ...p.hero, [k]: v } } : p));
  const uSocial = <K extends keyof Settings["social"]>(k: K, v: string) =>
    setS((p) => (p ? { ...p, social: { ...p.social, [k]: v } } : p));

  function row<T,>(arr: T[], i: number, patch: Partial<T>): T[] {
    return arr.map((x, j) => (j === i ? { ...x, ...patch } : x));
  }

  async function save() {
    if (!s) return;
    setSaving(true);
    try {
      await apiPatch("/api/v1/settings", {
        gymName: s.gymName,
        tagline: s.tagline,
        logoUrl: s.logoUrl,
        address: s.address,
        city: s.city,
        phone: s.phone,
        email: s.email,
        website: s.website,
        mapLink: s.mapLink,
        social: s.social,
        currency: s.currency,
        timezone: s.timezone,
        taxLabel: s.taxLabel,
        taxPercentDefault: Number(s.taxPercentDefault),
        invoicePrefix: s.invoicePrefix,
        receiptFooter: s.receiptFooter,
        hero: s.hero,
        openingHours: s.openingHours,
        facilities: s.facilities,
        testimonials: s.testimonials,
        faqs: s.faqs,
        gallery: s.gallery,
        membershipPolicy: s.membershipPolicy,
        cancellationPolicy: s.cancellationPolicy,
        refundPolicy: s.refundPolicy,
        privacyPolicy: s.privacyPolicy,
        terms: s.terms,
        expiryReminderWindowsDays: s.expiryReminderWindowsDays,
        allowPartialPayments: s.allowPartialPayments,
        allowSelfRegistration: s.allowSelfRegistration,
        themePrimary: s.themePrimary,
      });
      toast({ title: "Settings saved", description: "Live website updated.", variant: "success" });
      qc.invalidateQueries({ queryKey: ["site-settings"] });
      qc.invalidateQueries({ queryKey: ["public-site"] });
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof ApiClientError ? e.message : "Try again", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !s) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const field = (
    k: keyof Settings,
    label: string,
    opts: { type?: string; placeholder?: string; area?: boolean; rows?: number } = {},
  ) => (
    <div className="grid gap-1.5">
      <Label htmlFor={String(k)} className="text-xs text-zinc-400">{label}</Label>
      {opts.area ? (
        <Textarea id={String(k)} rows={opts.rows ?? 3} value={String(s[k] ?? "")} onChange={(e) => u(k, e.target.value as never)} className="border-zinc-700 bg-zinc-950 text-zinc-100" />
      ) : (
        <Input id={String(k)} type={opts.type ?? "text"} placeholder={opts.placeholder} value={String(s[k] ?? "")} onChange={(e) => u(k, (opts.type === "number" ? Number(e.target.value) : e.target.value) as never)} className="border-zinc-700 bg-zinc-950 text-zinc-100" />
      )}
    </div>
  );

  const listEditor = <T extends Record<string, unknown>>(
    items: T[],
    onChange: (next: T[]) => void,
    blank: T,
    render: (item: T, set: (patch: Partial<T>) => void, remove: () => void, i: number) => React.ReactNode,
  ) => (
    <div className="grid gap-3">
      {items.map((item, i) => (
        <div key={i} className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          {render(
            item,
            (patch) => onChange(row(items, i, patch)),
            () => onChange(items.filter((_, j) => j !== i)),
            i,
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="border-zinc-700 bg-transparent justify-self-start" onClick={() => onChange([...items, blank])}>
        <Plus className="h-3.5 w-3.5" /> Add
      </Button>
    </div>
  );

  const removeBtn = (onRemove: () => void) => (
    <Button type="button" size="sm" variant="outline" className="h-7 w-7 border-red-900 bg-transparent p-0 text-red-400 hover:bg-red-950" onClick={onRemove} aria-label="Remove">
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gym settings</h1>
          <p className="text-sm text-zinc-400">Everything on the public website is driven from here.</p>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save settings"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              tab === t.key ? "bg-primary text-primary-foreground" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader className="pb-3"><CardTitle className="text-base">General</CardTitle><CardDescription>Identity, branding and defaults.</CardDescription></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {field("gymName", "Gym name")}
              {field("tagline", "Tagline")}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("logoUrl", "Logo URL", { placeholder: "https://..." })}
              <div className="grid gap-1.5">
                <Label htmlFor="themePrimary" className="text-xs text-zinc-400">Theme colour</Label>
                <div className="flex gap-2">
                  <input id="themePrimary" type="color" value={s.themePrimary || "#f97316"} onChange={(e) => u("themePrimary", e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-zinc-700 bg-zinc-950" />
                  <Input value={s.themePrimary} onChange={(e) => u("themePrimary", e.target.value)} className="border-zinc-700 bg-zinc-950 font-mono text-zinc-100" />
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-zinc-400">Currency</Label>
                <Select value={s.currency} onChange={(e) => u("currency", e.target.value)} className="border-zinc-700 bg-zinc-950 text-zinc-100">
                  {["INR", "USD", "EUR", "GBP", "AED"].map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              {field("timezone", "Timezone")}
              {field("taxPercentDefault", "Default tax %", { type: "number" })}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "contact" && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader className="pb-3"><CardTitle className="text-base">Contact & social</CardTitle><CardDescription>Shown in the footer, contact page and emails.</CardDescription></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {field("address", "Address")}
              {field("city", "City")}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {field("phone", "Phone")}
              {field("email", "Email", { type: "email" })}
              {field("website", "Website")}
            </div>
            {field("mapLink", "Google Maps link")}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-zinc-400">Facebook</Label>
                <Input value={s.social.facebook} onChange={(e) => uSocial("facebook", e.target.value)} className="border-zinc-700 bg-zinc-950 text-zinc-100" placeholder="https://facebook.com/..." />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-zinc-400">Instagram</Label>
                <Input value={s.social.instagram} onChange={(e) => uSocial("instagram", e.target.value)} className="border-zinc-700 bg-zinc-950 text-zinc-100" placeholder="https://instagram.com/..." />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-zinc-400">YouTube</Label>
                <Input value={s.social.youtube} onChange={(e) => uSocial("youtube", e.target.value)} className="border-zinc-700 bg-zinc-950 text-zinc-100" placeholder="https://youtube.com/..." />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-zinc-400">X / Twitter</Label>
                <Input value={s.social.twitter} onChange={(e) => uSocial("twitter", e.target.value)} className="border-zinc-700 bg-zinc-950 text-zinc-100" placeholder="https://x.com/..." />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "hero" && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader className="pb-3"><CardTitle className="text-base">Homepage hero</CardTitle><CardDescription>The first thing visitors see.</CardDescription></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label className="text-xs text-zinc-400">Title</Label>
              <Input value={s.hero.title} onChange={(e) => uHero("title", e.target.value)} className="border-zinc-700 bg-zinc-950 text-zinc-100" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-zinc-400">Subtitle</Label>
              <Textarea rows={3} value={s.hero.subtitle} onChange={(e) => uHero("subtitle", e.target.value)} className="border-zinc-700 bg-zinc-950 text-zinc-100" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-zinc-400">CTA button text</Label>
                <Input value={s.hero.ctaText} onChange={(e) => uHero("ctaText", e.target.value)} className="border-zinc-700 bg-zinc-950 text-zinc-100" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-zinc-400">Background image URL</Label>
                <Input value={s.hero.imageUrl} onChange={(e) => uHero("imageUrl", e.target.value)} className="border-zinc-700 bg-zinc-950 text-zinc-100" placeholder="https://..." />
              </div>
            </div>
            {s.hero.imageUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={s.hero.imageUrl} alt="Hero preview" className="h-40 w-full rounded-lg border border-zinc-800 object-cover" />
            )}
          </CardContent>
        </Card>
      )}

      {tab === "hours" && (
        <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="pb-3"><CardTitle className="text-base">Opening hours</CardTitle><CardDescription>Displayed in the footer and contact page.</CardDescription></CardHeader>
          <CardContent className="grid gap-2">
            {s.openingHours.map((h, i) => (
              <div key={h.day} className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
                <span className="w-12 text-sm font-semibold">{h.day}</span>
                <Input type="time" value={h.open} disabled={h.closed} onChange={(e) => u("openingHours", row(s.openingHours, i, { open: e.target.value }))} className="h-8 w-32 border-zinc-700 bg-zinc-900 text-zinc-100" />
                <span className="text-zinc-500">→</span>
                <Input type="time" value={h.close} disabled={h.closed} onChange={(e) => u("openingHours", row(s.openingHours, i, { close: e.target.value }))} className="h-8 w-32 border-zinc-700 bg-zinc-900 text-zinc-100" />
                <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
                  <input type="checkbox" className="accent-primary" checked={h.closed} onChange={(e) => u("openingHours", row(s.openingHours, i, { closed: e.target.checked }))} />
                  Closed
                </label>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tab === "content" && (
        <>
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="pb-3"><CardTitle className="text-base">Facilities</CardTitle><CardDescription>Feature cards on the homepage.</CardDescription></CardHeader>
            <CardContent>
              {listEditor(
                s.facilities,
                (next) => u("facilities", next),
                { title: "", description: "", icon: "dumbbell" },
                (item, set, remove) => (
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_120px_auto] sm:items-end">
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-zinc-400">Title</Label>
                      <Input value={String(item.title)} onChange={(e) => set({ title: e.target.value } as never)} className="border-zinc-700 bg-zinc-900 text-zinc-100" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-zinc-400">Description</Label>
                      <Input value={String(item.description)} onChange={(e) => set({ description: e.target.value } as never)} className="border-zinc-700 bg-zinc-900 text-zinc-100" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-zinc-400">Icon</Label>
                      <Select value={String(item.icon)} onChange={(e) => set({ icon: e.target.value } as never)} className="border-zinc-700 bg-zinc-900 text-zinc-100">
                        {["dumbbell", "heart", "users", "sparkles", "shower", "wifi", "car", "locker"].map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                      </Select>
                    </div>
                    <div className="justify-self-end">{removeBtn(remove)}</div>
                  </div>
                ),
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="pb-3"><CardTitle className="text-base">FAQs</CardTitle><CardDescription>Accordion on the homepage.</CardDescription></CardHeader>
            <CardContent>
              {listEditor(
                s.faqs,
                (next) => u("faqs", next),
                { question: "", answer: "" },
                (item, set, remove) => (
                  <div className="grid gap-3">
                    <div className="flex items-end gap-3">
                      <div className="grid flex-1 gap-1.5">
                        <Label className="text-xs text-zinc-400">Question</Label>
                        <Input value={String(item.question)} onChange={(e) => set({ question: e.target.value } as never)} className="border-zinc-700 bg-zinc-900 text-zinc-100" />
                      </div>
                      {removeBtn(remove)}
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-zinc-400">Answer</Label>
                      <Textarea rows={2} value={String(item.answer)} onChange={(e) => set({ answer: e.target.value } as never)} className="border-zinc-700 bg-zinc-900 text-zinc-100" />
                    </div>
                  </div>
                ),
              )}
            </CardContent>
          </Card>
        </>
      )}

      {tab === "socialproof" && (
        <>
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="pb-3"><CardTitle className="text-base">Testimonials</CardTitle><CardDescription>Member quotes on the homepage.</CardDescription></CardHeader>
            <CardContent>
              {listEditor(
                s.testimonials,
                (next) => u("testimonials", next),
                { name: "", quote: "", rating: 5 },
                (item, set, remove) => (
                  <div className="grid gap-3 sm:grid-cols-[160px_1fr_90px_auto] sm:items-end">
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-zinc-400">Name</Label>
                      <Input value={String(item.name)} onChange={(e) => set({ name: e.target.value } as never)} className="border-zinc-700 bg-zinc-900 text-zinc-100" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-zinc-400">Quote</Label>
                      <Input value={String(item.quote)} onChange={(e) => set({ quote: e.target.value } as never)} className="border-zinc-700 bg-zinc-900 text-zinc-100" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-zinc-400">Stars</Label>
                      <Input type="number" min={1} max={5} value={Number(item.rating)} onChange={(e) => set({ rating: Number(e.target.value) } as never)} className="border-zinc-700 bg-zinc-900 text-zinc-100" />
                    </div>
                    <div className="justify-self-end">{removeBtn(remove)}</div>
                  </div>
                ),
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="pb-3"><CardTitle className="text-base">Gallery</CardTitle><CardDescription>Photos shown on the site.</CardDescription></CardHeader>
            <CardContent>
              {listEditor(
                s.gallery,
                (next) => u("gallery", next),
                { url: "", caption: "" },
                (item, set, remove) => (
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-zinc-400">Image URL</Label>
                      <Input value={String(item.url)} onChange={(e) => set({ url: e.target.value } as never)} className="border-zinc-700 bg-zinc-900 text-zinc-100" placeholder="https://..." />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-zinc-400">Caption</Label>
                      <Input value={String(item.caption)} onChange={(e) => set({ caption: e.target.value } as never)} className="border-zinc-700 bg-zinc-900 text-zinc-100" />
                    </div>
                    <div className="justify-self-end">{removeBtn(remove)}</div>
                  </div>
                ),
              )}
            </CardContent>
          </Card>
        </>
      )}

      {tab === "policies" && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader className="pb-3"><CardTitle className="text-base">Policies</CardTitle><CardDescription>Printed on receipts and the policies page.</CardDescription></CardHeader>
          <CardContent className="grid gap-4">
            {field("membershipPolicy", "Membership policy", { area: true, rows: 3 })}
            {field("cancellationPolicy", "Cancellation policy", { area: true, rows: 3 })}
            {field("refundPolicy", "Refund policy", { area: true, rows: 3 })}
            {field("privacyPolicy", "Privacy policy", { area: true, rows: 3 })}
            {field("terms", "Terms of use", { area: true, rows: 3 })}
            {field("receiptFooter", "Receipt footer")}
          </CardContent>
        </Card>
      )}

      {tab === "ops" && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader className="pb-3"><CardTitle className="text-base">Operations</CardTitle><CardDescription>Invoicing, reminders and self-service rules.</CardDescription></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {field("invoicePrefix", "Invoice prefix")}
              <div className="grid gap-1.5">
                <Label className="text-xs text-zinc-400">Expiry reminder days (comma separated)</Label>
                <Input
                  value={s.expiryReminderWindowsDays.join(", ")}
                  onChange={(e) => u("expiryReminderWindowsDays", e.target.value.split(",").map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n >= 1 && n <= 60))}
                  className="border-zinc-700 bg-zinc-950 text-zinc-100"
                  placeholder="7, 3, 1"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-6 rounded-lg border border-zinc-800 p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" className="accent-primary" checked={s.allowPartialPayments} onChange={(e) => u("allowPartialPayments", e.target.checked)} />
                Allow partial payments
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" className="accent-primary" checked={s.allowSelfRegistration} onChange={(e) => u("allowSelfRegistration", e.target.checked)} />
                Allow self-registration on website
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
