"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { X } from "lucide-react";

type Ctx = { open: boolean; onOpenChange: (v: boolean) => void };
const DialogCtx = React.createContext<Ctx>({ open: false, onOpenChange: () => {} });

export function Dialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (v: boolean) => void; children: React.ReactNode }) {
  return <DialogCtx.Provider value={{ open, onOpenChange }}>{open ? children : null}</DialogCtx.Provider>;
}

export function DialogTrigger({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return <span onClick={onClick} className="inline-flex cursor-pointer">{children}</span>;
}

export function DialogContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const { onOpenChange } = React.useContext(DialogCtx);
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onOpenChange(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onOpenChange]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 animate-in-fade" onClick={() => onOpenChange(false)} />
      <div className={cn("relative z-50 grid w-full max-w-lg gap-4 rounded-xl border bg-background p-6 shadow-lg animate-in-fade max-h-[90vh] overflow-y-auto", className)}>
        <button className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100" onClick={() => onOpenChange(false)} aria-label="Close">
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col space-y-1.5 text-left">{children}</div>;
}
export function DialogTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)}>{children}</h2>;
}
export function DialogDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
export function DialogFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}>{children}</div>;
}
