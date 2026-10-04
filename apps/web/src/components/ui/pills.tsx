import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Eyebrow pill — section label above a title. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border border-line-strong px-2.5 caption font-medium text-fg",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Filter chip — 28px visual, 40px hit area. */
export function Chip({
  active,
  children,
  onClick,
  className,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("group relative inline-flex h-10 items-center whitespace-nowrap", className)}
    >
      <span
        className={cn(
          "inline-flex h-7 items-center rounded-full border px-3 mono-sm transition-colors duration-150",
          active
            ? "border-white bg-white text-fg-inverse"
            : "border-line bg-surface-1 text-fg group-hover:border-line-strong",
        )}
      >
        {children}
      </span>
    </button>
  );
}

/** Tag — small square-ish metadata label. */
export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-[4px] border border-line bg-canvas px-1.5 mono-xs text-fg-2",
        className,
      )}
    >
      {children}
    </span>
  );
}

export type StatusTone = "accent" | "live" | "pass" | "fail" | "muted" | "warning";

const DOT: Record<StatusTone, string> = {
  accent: "bg-accent",
  live: "bg-white",
  pass: "bg-pass",
  fail: "bg-fail",
  muted: "bg-fg-3",
  warning: "bg-warning",
};

/** Live dot with optional pulse ring. */
export function LiveDot({
  tone = "accent",
  pulse = true,
  className,
}: {
  tone?: StatusTone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex size-1.5 shrink-0", className)} aria-hidden="true">
      {pulse && (
        <span className={cn("absolute inset-0 rounded-full animate-pulse-ring", DOT[tone])} />
      )}
      <span className={cn("relative size-1.5 rounded-full", DOT[tone])} />
    </span>
  );
}

/** Status chip — tag + leading dot; PASS/FAIL also carry ▲/▼ so meaning never relies on color alone. */
export function StatusChip({
  tone,
  label,
  pulse,
  className,
  glyph: showGlyph = true,
}: {
  tone: StatusTone;
  label: string;
  pulse?: boolean;
  className?: string;
  /** ▲/▼ mark verdict outcomes; health indicators turn it off (their label carries the meaning). */
  glyph?: boolean;
}) {
  const glyph = !showGlyph ? "" : tone === "pass" ? "▲ " : tone === "fail" ? "▼ " : "";
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 mono-xs text-fg",
        className,
      )}
    >
      <LiveDot tone={tone} pulse={pulse ?? (tone === "accent" || tone === "live")} />
      {glyph}
      {label}
    </span>
  );
}
