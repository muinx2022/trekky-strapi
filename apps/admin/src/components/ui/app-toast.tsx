"use client";

import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useEffect, useState } from "react";

type ToastVariant = "success" | "error" | "info";

type ToastOptions = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastItem = ToastOptions & {
  id: string;
};

type ToastListener = (message: ToastItem) => void;

const listeners = new Set<ToastListener>();

function emitToast(message: ToastItem) {
  listeners.forEach((listener) => listener(message));
}

export function toast(options: ToastOptions) {
  emitToast({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    variant: options.variant ?? "info",
    durationMs: options.durationMs ?? 3200,
    title: options.title,
    description: options.description,
  });
}

export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast: ToastListener = (message) => {
      setItems((prev) => [...prev, message]);
      const duration = Math.max(1200, message.durationMs ?? 3200);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== message.id));
      }, duration);
    };

    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {items.map((item) => {
        const icon =
          item.variant === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : item.variant === "error" ? (
            <AlertCircle className="h-4 w-4 text-destructive" />
          ) : (
            <Info className="h-4 w-4 text-primary" />
          );

        return (
          <div
            key={item.id}
            className="pointer-events-auto rounded-md border bg-background p-3 shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <span className="mt-0.5">{icon}</span>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
                aria-label="Close notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

