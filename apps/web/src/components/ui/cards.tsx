import { big, formatScaledPrice, formatTokenPrice, formatUsd } from "@moneta/sdk";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { listingHref, memoSummary, STATUS_META, type Listing } from "@/lib/listing";
import { StatusChip, Tag } from "./pills";

/** Stat tile: mono label top, big figure bottom. */
export function StatTile({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[168px] flex-col justify-between rounded-[16px] border border-line-subtle bg-surface-1 p-6",
        className,
      )}
    >
      <p className="mono-sm text-fg">{label}</p>
      <div>
        <div className="figure-xl">{value}</div>
        {sub && <p className="mono-xs mt-2 text-fg-3">{sub}</p>}
      </div>
    </div>
  );
}

/** Bento card: title top-left, mono body bottom-left. */
export function BentoCard({
  title,
  body,
  className,
}: {
  title: ReactNode;
  body: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[168px] flex-col justify-between gap-10 rounded-[16px] border border-line-subtle bg-surface-1 p-6",
        className,
      )}
    >
      <h3 className="heading-sm max-w-[14ch]">{title}</h3>
      <p className="mono-sm max-w-[48ch] text-fg">{body}</p>
    </div>
  );
}

/** Project card (Explore + landing carousel). Chain-authoritative values live on the detail pages. */
export function ProjectCard({ l, className }: { l: Listing; className?: string }) {
  const meta = STATUS_META[l.status];
  const raised =
    l.raise.status === "SUCCEEDED" ? big(l.raise.accepted) : big(l.raise.totalContributed);
  const progress =
    Number((big(l.raise.totalContributed) * 1000n) / (big(l.raise.maxRaise) || 1n)) / 10;
  return (
    <Link
      href={listingHref(l)}
      className={cn(
        "group flex min-h-[260px] flex-col justify-between gap-6 rounded-[16px] border border-line-subtle bg-surface-1 p-6 transition-colors duration-150 hover:border-line-strong",
        className,
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden
              className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-3 mono-xs text-fg"
            >
              {l.raise.symbol.slice(0, 1)}
            </span>
            <h3 className="heading-md truncate">{l.raise.name}</h3>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip tone={meta.tone} label={meta.label} />
          <Tag>${l.raise.symbol}</Tag>
          {l.project && <Tag>{l.project.holderCount} holders</Tag>}
        </div>
      </div>
      <p className="body-sm line-clamp-2 text-fg-2">
        {memoSummary(l.raise.memo) || "No description."}
      </p>
      <dl className="grid grid-cols-2 gap-3 border-t border-line-subtle pt-4">
        <div>
          <dt className="mono-xs text-fg-3">
            {l.status === "raising"
              ? "Committed"
              : l.status === "refunding"
                ? "Refunding"
                : "Raised"}
          </dt>
          <dd className="body tabular mt-1">{formatUsd(raised, 6, { compact: true })}</dd>
        </div>
        <div>
          <dt className="mono-xs text-fg-3">{l.status === "raising" ? "Of max" : "Price"}</dt>
          <dd className="body tabular mt-1">
            {l.status === "raising"
              ? `${progress.toFixed(0)}%`
              : l.project && big(l.project.lastPrice) > 0n
                ? formatScaledPrice(big(l.project.lastPrice))
                : formatTokenPrice(big(l.raise.price))}
          </dd>
        </div>
      </dl>
    </Link>
  );
}
