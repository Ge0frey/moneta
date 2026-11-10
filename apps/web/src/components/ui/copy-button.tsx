"use client";

import { Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";

/** Copies `text` on click. The only client code an address chip needs. */
export function CopyButton({ text, children }: { text: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="inline-flex items-center gap-1 rounded-[4px] px-1 py-0.5 hover:bg-surface-2 hover:text-fg"
      aria-label={`Copy ${text}`}
    >
      {children}
      {copied ? (
        <Check className="size-3 text-pass" aria-hidden />
      ) : (
        <Copy className="size-3" aria-hidden />
      )}
    </button>
  );
}
