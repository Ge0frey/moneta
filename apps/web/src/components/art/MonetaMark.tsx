import { cn } from "@/lib/cn";

/** Moneta mark — a temple glyph (pediment over three columns) on a square grid. */
export function MonetaMark({
  className,
  title = "Moneta",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-5", className)}
      role="img"
      aria-label={title}
      fill="currentColor"
    >
      <path d="M12 2 22 7.5V9H2V7.5L12 2Z" />
      <rect x="4" y="10.5" width="3" height="8" />
      <rect x="10.5" y="10.5" width="3" height="8" />
      <rect x="17" y="10.5" width="3" height="8" />
      <rect x="2" y="20" width="20" height="2" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-[17px] font-medium tracking-[-0.02em]",
        className,
      )}
    >
      <MonetaMark className="size-[18px]" title="" />
      Moneta
    </span>
  );
}
