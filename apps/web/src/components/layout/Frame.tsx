import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The 4-column hairline frame. Lines run behind text and under (opaque) cards.
 * narrative = 1000px (landing/docs/wizard), app = 1200px. ≥1024: 4 columns; 768–1023: 2; <768: edges only.
 */
export function Frame({
  variant = "app",
  children,
  className,
}: {
  variant?: "app" | "narrative";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full px-4 sm:px-6 xl:px-0",
        variant === "narrative"
          ? "max-w-[1000px] xl:max-w-[1000px]"
          : "max-w-[1248px] xl:max-w-[1200px]",
        className,
      )}
    >
      <div className="relative">
        <GridLines />
        <div className="relative z-[1]">{children}</div>
      </div>
    </div>
  );
}

function GridLines() {
  const lines: { pos: number; cls: string }[] = [
    { pos: 0, cls: "" },
    { pos: 25, cls: "hidden lg:block" },
    { pos: 50, cls: "hidden md:block" },
    { pos: 75, cls: "hidden lg:block" },
    { pos: 100, cls: "" },
  ];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
      {lines.map((l) => (
        <span
          key={l.pos}
          className={cn("absolute inset-y-0 w-px bg-line-grid", l.cls)}
          style={{ left: l.pos === 100 ? "calc(100% - 1px)" : `${l.pos}%` }}
        />
      ))}
    </div>
  );
}

/** Section tick marks at a boundary: left extends inward, centre centred, right extends inward. */
export function Ticks({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-x-0 top-0 h-px", className)}
    >
      <span className="absolute left-0 h-px w-3 bg-tick" />
      <span className="absolute left-1/2 hidden h-px w-3 -translate-x-1/2 bg-tick md:block" />
      <span className="absolute right-0 h-px w-3 bg-tick" />
    </div>
  );
}

/** A frame section: generous vertical rhythm with ticks at its top boundary (landing: 192px between sections). */
export function Section({
  children,
  className,
  ticks = true,
  id,
  dense,
}: {
  children: ReactNode;
  className?: string;
  ticks?: boolean;
  id?: string;
  dense?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn("relative", dense ? "py-8 lg:py-12" : "py-20 lg:py-24", className)}
    >
      {ticks && <Ticks />}
      {children}
    </section>
  );
}
