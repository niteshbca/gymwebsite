"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { ChevronDown } from "lucide-react";

export function Accordion({ type = "single", collapsible, children, className }: {
  type?: "single" | "multiple";
  collapsible?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState<string | null>(null);
  return (
    <div className={cn("divide-y rounded-lg border", className)} data-type={type} data-collapsible={collapsible}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child) ? React.cloneElement(child as React.ReactElement<{ __ctx?: { open: string | null; setOpen: (v: string | null) => void } }>, {
          __ctx: { open, setOpen },
        }) : child,
      )}
    </div>
  );
}

export function AccordionItem({ value, children, __ctx }: { value: string; children: React.ReactNode; __ctx?: { open: string | null; setOpen: (v: string | null) => void } }) {
  const isOpen = __ctx?.open === value;
  return (
    <div>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<{ __open?: boolean; __toggle?: () => void }>, {
              __open: isOpen,
              __toggle: () => __ctx?.setOpen(isOpen ? null : value),
            })
          : child,
      )}
    </div>
  );
}

export function AccordionTrigger({ children, __open, __toggle }: { children: React.ReactNode; __open?: boolean; __toggle?: () => void }) {
  return (
    <button
      type="button"
      onClick={__toggle}
      className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-muted/50"
      aria-expanded={__open}
    >
      {children}
      <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", __open && "rotate-180")} />
    </button>
  );
}

export function AccordionContent({ children, __open }: { children: React.ReactNode; __open?: boolean }) {
  if (!__open) return null;
  return <div className="px-4 pb-4 text-sm text-muted-foreground">{children}</div>;
}
