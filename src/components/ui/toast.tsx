"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

type Toast = { id: number; title: string; description?: string; variant?: "default" | "success" | "error" };
type Ctx = { toasts: Toast[]; toast: (t: Omit<Toast, "id">) => void; dismiss: (id: number) => void };

const ToastCtx = React.createContext<Ctx>({ toasts: [], toast: () => {}, dismiss: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const dismiss = React.useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = React.useCallback(
    (t: Omit<Toast, "id">) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev.slice(-4), { ...t, id }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );
  return (
    <ToastCtx.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto relative rounded-lg border bg-background p-4 pr-8 shadow-lg animate-in-fade",
              t.variant === "success" && "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
              t.variant === "error" && "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100",
            )}
            role="status"
          >
            <div className="flex items-start gap-2">
              {t.variant === "success" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
              {t.variant === "error" && <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
              {!t.variant && <Info className="mt-0.5 h-4 w-4 shrink-0" />}
              <div>
                <p className="text-sm font-medium">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs opacity-90">{t.description}</p>}
              </div>
            </div>
            <button onClick={() => dismiss(t.id)} className="absolute right-2 top-2 opacity-60 hover:opacity-100" aria-label="Dismiss">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return React.useContext(ToastCtx);
}
