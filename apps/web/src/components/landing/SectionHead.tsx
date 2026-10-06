import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Roman-numeral index label: "III — Decision markets". */
export function Index({ n, label, className }: { n: string; label: string; className?: string }) {
  return (
    <p className={cn("label-mono flex items-center gap-3 text-fg-3", className)}>
      <span className="text-fg">{n}</span>
      <span aria-hidden className="h-px w-6 bg-line-strong" />
      {label}
    </p>
  );
}

/**
 * Landing section header. The index sits in the frame's first column; the title and copy start
 * on the 25% line, so every section reads off the same grid.
 */
export function SectionHead({
  n,
  label,
  title,
  children,
  className,
}: {
  n: string;
  label: string;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("grid items-start gap-y-6 lg:grid-cols-4", className)}>
      <Index n={n} label={label} className="lg:pt-4" />
      <div className="flex flex-col gap-6 lg:col-span-3 lg:pl-6">
        <h2 className="heading-xl max-w-[20ch]">{title}</h2>
        {children}
      </div>
    </header>
  );
}
