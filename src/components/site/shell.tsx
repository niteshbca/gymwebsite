"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Menu, X, Dumbbell, Phone, Mail, MapPin, Facebook, Instagram, Youtube, Twitter } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export type PublicSite = {
  settings: {
    gymName: string; tagline: string; logoUrl: string; address: string; city: string; phone: string; email: string;
    social: { facebook: string; instagram: string; youtube: string; twitter: string };
    openingHours: { day: string; open: string; close: string; closed: boolean }[];
    facilities: { title: string; description: string; icon: string }[];
    trainersPublic: { name: string; specialty: string; photo: string; bio: string }[];
    testimonials: { name: string; quote: string; rating: number }[];
    faqs: { question: string; answer: string }[];
    hero: { title: string; subtitle: string; ctaText: string; imageUrl: string };
    taxLabel: string; mapLink: string; membershipPolicy: string; cancellationPolicy: string; refundPolicy: string;
    privacyPolicy: string; terms: string; themePrimary: string; allowSelfRegistration: boolean;
  };
  plans: { id: string; name: string; description: string; image: string; features: string[]; popular: boolean; priceMinor: number; durationValue: number; durationUnit: string; joiningFeeMinor: number; classAccess: string; freezeAllowed: boolean; includedSessions: number; category: string }[];
  classes: { id: string; name: string; description: string; image: string; intensity: string; trainerName: string; dayOfWeek: number; startTime: string; endTime: string; room: string; capacity: number; seatsLeft: number; nextDate: string }[];
  branches: { id: string; name: string; city: string; address: string; phone: string }[];
};

export function useSite() {
  return useQuery({
    queryKey: ["public-site"],
    queryFn: async () => {
      const res = await fetch("/api/v1/public/site");
      const json = await res.json();
      if (!json.success) throw new Error("Failed to load site");
      return json.data as PublicSite;
    },
  });
}

const NAV = [
  { href: "/", label: "Home" },
  { href: "/plans", label: "Memberships" },
  { href: "/classes", label: "Classes" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader({ site }: { site?: PublicSite }) {
  const [open, setOpen] = useState(false);
  const name = site?.settings.gymName ?? "NiteshPro";
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="rounded-lg bg-primary p-1.5 text-primary-foreground"><Dumbbell className="h-5 w-5" /></span>
          <span className="text-lg">{name}</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login"><Button variant="outline" size="sm">Staff Login</Button></Link>
          <Link href={site?.settings.allowSelfRegistration === false ? "/contact" : "/register"}>
            <Button size="sm">Join Now</Button>
          </Link>
        </div>
        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <div className="border-t bg-background px-4 pb-4 md:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="block py-3 text-sm font-medium">
              {n.label}
            </Link>
          ))}
          <div className="mt-2 flex gap-2">
            <Link href="/login" className="flex-1"><Button variant="outline" className="w-full">Staff Login</Button></Link>
            <Link href="/register" className="flex-1"><Button className="w-full">Join Now</Button></Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter({ site }: { site?: PublicSite }) {
  const s = site?.settings;
  return (
    <footer className="border-t bg-muted/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-bold">{s?.gymName ?? "NiteshPro"}</p>
          <p className="mt-2 text-sm text-muted-foreground">{s?.tagline}</p>
          <div className="mt-4 space-y-1 text-sm text-muted-foreground">
            <p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{s?.address}, {s?.city}</p>
            <p className="flex items-center gap-2"><Phone className="h-4 w-4" />{s?.phone}</p>
            <p className="flex items-center gap-2"><Mail className="h-4 w-4" />{s?.email}</p>
          </div>
          <div className="mt-4 flex gap-3">
            {s?.social.facebook && <a href={s.social.facebook} aria-label="Facebook"><Facebook className="h-5 w-5 text-muted-foreground hover:text-primary" /></a>}
            {s?.social.instagram && <a href={s.social.instagram} aria-label="Instagram"><Instagram className="h-5 w-5 text-muted-foreground hover:text-primary" /></a>}
            {s?.social.youtube && <a href={s.social.youtube} aria-label="YouTube"><Youtube className="h-5 w-5 text-muted-foreground hover:text-primary" /></a>}
            {s?.social.twitter && <a href={s.social.twitter} aria-label="Twitter"><Twitter className="h-5 w-5 text-muted-foreground hover:text-primary" /></a>}
          </div>
        </div>
        <div>
          <p className="font-semibold">Opening Hours</p>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {s?.openingHours.map((h) => (
              <li key={h.day} className="flex justify-between"><span>{h.day}</span><span>{h.closed ? "Closed" : `${h.open} – ${h.close}`}</span></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-semibold">Quick Links</p>
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            <li><Link href="/plans" className="hover:text-foreground">Membership Plans</Link></li>
            <li><Link href="/classes" className="hover:text-foreground">Class Schedule</Link></li>
            <li><Link href="/about" className="hover:text-foreground">About Us</Link></li>
            <li><Link href="/contact" className="hover:text-foreground">Contact & Enquiry</Link></li>
            <li><Link href="/login" className="hover:text-foreground">Member / Staff Login</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">Legal</p>
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            <li><Link href="/terms" className="hover:text-foreground">Terms of Use</Link></li>
            <li><Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
            <li><Link href="/refund" className="hover:text-foreground">Cancellation & Refund Policy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {s?.gymName ?? "NiteshPro"}. All rights reserved.
      </div>
    </footer>
  );
}
