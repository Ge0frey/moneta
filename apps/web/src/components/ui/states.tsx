"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { AsciiField } from "../art/AsciiField";
import type { Motif } from "../art/motifs";
import { Button } from "./button";

/** Skeleton — surface blocks with a slow luminance sweep. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block max-w-full rounded-[8px] bg-surface-2 bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.05),transparent)] bg-[length:200%_100%] align-middle animate-sweep",
        className,
      )}
    />
  );
}

export function EmptyState({
  title,
  body,
  action,
  motif = "coins",
  className,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  motif?: Motif;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-[16px] border border-line-subtle bg-surface-1 px-6 py-10 text-center",
        className,
      )}
    >
      <AsciiField motif={motif} className="h-[110px] w-[180px]" cell={8} zoom={0.42} dust={0} />
      <h3 className="heading-sm">{title}</h3>
      {body && <p className="body-sm max-w-[44ch] text-fg-2">{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Couldn't load this",
  body,
  onRetry,
  className,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-3 rounded-[16px] border border-fail/40 bg-fail-subtle p-6",
        className,
      )}
    >
      <p className="body-sm font-medium text-fg">⚠ {title}</p>
      {body && <p className="mono-sm text-fg-2">{body}</p>}
      {onRetry && (
        <Button variant="tertiary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
