"use client";

import { explorerTxUrl, shortAddress } from "@moneta/sdk";
import { Check, CircleAlert, X } from "lucide-react";
import { useEffect } from "react";
import { CHAIN_ID } from "@/lib/env";
import { cn } from "@/lib/cn";
import { useToasts, type Toast } from "@/lib/toasts";

function Indicator({ state }: { state: Toast["state"] }) {
  if (state === "signing")
    return (
      <span className="size-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
    );
  if (state === "pending")
    return (
      <span className="relative inline-flex size-2">
        <span className="absolute inset-0 rounded-full bg-white animate-pulse-ring" />
        <span className="relative size-2 rounded-full bg-white" />
      </span>
    );
  if (state === "confirmed") return <Check className="size-4 text-pass" aria-hidden />;
  if (state === "final") return <Check className="size-4 text-accent" aria-hidden />;
  if (state === "info") return <Check className="size-4 text-fg-2" aria-hidden />;
  return <CircleAlert className="size-4 text-fail" aria-hidden />;
}

const LABEL: Record<Toast["state"], string> = {
  signing: "Waiting for signature",
  pending: "Confirming",
  confirmed: "Confirmed",
  final: "Final",
  reverted: "Reverted",
  error: "Failed",
  info: "Done",
};

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useToasts((s) => s.dismiss);
  useEffect(() => {
    if (t.state !== "final" && t.state !== "info") return;
    const id = setTimeout(() => dismiss(t.id), 6000);
    return () => clearTimeout(id);
  }, [t.state, t.id, dismiss]);
  const url = t.hash ? explorerTxUrl(CHAIN_ID, t.hash) : undefined;
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex w-[360px] max-w-[calc(100vw-32px)] items-start gap-3 rounded-[12px] border bg-surface-1 p-3.5 shadow-[0_8px_24px_rgb(0_0_0/0.5)]",
        t.state === "reverted" || t.state === "error" ? "border-fail/50" : "border-line",
      )}
    >
      <span className="mt-0.5 grid size-4 place-items-center">
        <Indicator state={t.state} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="body-sm font-medium text-fg">{t.title}</p>
        <p className="mono-xs mt-1 text-fg-3">
          {LABEL[t.state]}
          {t.detail ? ` · ${t.detail}` : ""}
        </p>
        {t.hash && (
          <p className="mono-xs mt-1 text-fg-3">
            {url ? (
              <a
                className="underline-offset-2 hover:text-fg hover:underline"
                href={url}
                target="_blank"
                rel="noreferrer"
              >
                {shortAddress(t.hash, 6)} ↗
              </a>
            ) : (
              shortAddress(t.hash, 6)
            )}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismiss(t.id)}
        className="-m-2 grid size-10 place-items-center rounded-full text-fg-3 hover:text-fg"
        aria-label="Dismiss notification"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-20 z-[60] flex flex-col items-end gap-2 sm:right-6"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  );
}
