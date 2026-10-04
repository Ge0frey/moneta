"use client";

import { big, formatUsd } from "@moneta/sdk";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { MonetaMark } from "@/components/art/MonetaMark";
import { Button } from "@/components/ui/button";
import { ProjectCard, StatTile } from "@/components/ui/cards";
import { Chip, LiveDot } from "@/components/ui/pills";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useProjects, useProtocolStats, useRaises } from "@/lib/hooks/indexed";
import { buildListings, STATUS_META, type ListingStatus } from "@/lib/listing";

/* ── 8. Value pill: Capital, Settled In USDC ───────────────────────────────── */
export function ValuePill() {
  const { data, isLoading } = useProtocolStats();
  return (
    <div className="flex flex-col gap-6">
      <h2 className="heading-xl">Capital, Settled In USDC</h2>
      <p className="body max-w-[56ch] text-fg">
        Every raise is denominated in USDC on Monad. Total accepted across all launched Moneta
        raises:
      </p>
      <div className="flex h-24 items-center gap-4 rounded-full border border-line bg-canvas pr-3 pl-3 sm:gap-6 sm:pr-5">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-surface-3">
          <MonetaMark className="size-6" title="" />
        </span>
        <span className="figure-xl min-w-0 truncate">
          {isLoading ? <Skeleton className="h-10 w-40" /> : formatUsd(big(data?.totalRaised), 6)}
        </span>
        <span className="mono-xs ml-1 hidden items-center gap-1.5 text-fg-3 sm:inline-flex">
          <LiveDot tone="accent" /> live
        </span>
        <Button asChild variant="tertiary" className="ml-auto">
          <Link href="/explore">Back a Raise</Link>
        </Button>
      </div>
    </div>
  );
}

/* ── 11. Live stats ────────────────────────────────────────────────────────── */
export function LiveStats() {
  const { data, isLoading, isError, refetch } = useProtocolStats();
  if (isError) return <ErrorState body="The indexer is unreachable." onRetry={() => refetch()} />;
  const v = (x: React.ReactNode) => (isLoading ? <Skeleton className="h-10 w-24" /> : x);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <StatTile
        label="Total Raised"
        value={v(formatUsd(big(data?.totalRaised), 6, { compact: true }))}
        sub="USDC accepted by launched raises"
      />
      <StatTile
        label="Treasuries Governed"
        value={v(data?.projectCount ?? 0)}
        sub={`${data?.redeemedCount ?? 0} redeemed at NAV`}
      />
      <StatTile
        label="Verdicts Reached"
        value={v((data?.verdictsPassed ?? 0) + (data?.verdictsFailed ?? 0))}
        sub={`▲ ${data?.verdictsPassed ?? 0} PASS · ▼ ${data?.verdictsFailed ?? 0} FAIL`}
      />
      <StatTile label="Block Time" value="300 ms" sub="Monad · ~600 ms finality" />
    </div>
  );
}

/* ── 12. Live On Moneta: filters + carousel ────────────────────────────────── */
const FILTERS: ("all" | ListingStatus)[] = ["all", "raising", "governing", "verdict", "redeemed"];

export function LiveOnMoneta() {
  const raises = useRaises();
  const projects = useProjects();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const track = useRef<HTMLUListElement>(null);
  const listings = useMemo(
    () => buildListings(raises.data, projects.data),
    [raises.data, projects.data],
  );
  const shown = filter === "all" ? listings : listings.filter((l) => l.status === filter);

  const scroll = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth, 380), behavior: "smooth" });
  };

  return (
    <div className="flex flex-col gap-8">
      <h2 className="heading-xl">Live On Moneta</h2>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="-ml-1 flex gap-2 overflow-x-auto" role="group" aria-label="Filter projects">
          {FILTERS.map((f) => (
            <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : STATUS_META[f].filter}
            </Chip>
          ))}
        </div>
        <Link href="/explore" className="mono-sm text-fg-2 hover:text-fg">
          View All Raises →
        </Link>
      </div>

      {raises.isError ? (
        <ErrorState body="The indexer is unreachable." onRetry={() => raises.refetch()} />
      ) : raises.isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[260px] rounded-[16px]" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState
          title={
            filter === "all"
              ? "No raises yet"
              : `Nothing ${STATUS_META[filter as ListingStatus].label.toLowerCase()} right now`
          }
          body="Moneta is permissionless — the first raise could be yours."
          action={
            <Button asChild variant="tertiary" size="sm">
              <Link href="/create">Create a raise</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ul
            ref={track}
            className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:none]"
          >
            {shown.map((l) => (
              <li key={l.raise.id} className="w-[min(340px,85vw)] shrink-0 snap-start">
                <ProjectCard l={l} />
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => scroll(-1)}
              aria-label="Previous projects"
              className="grid size-10 place-items-center rounded-full border border-line bg-canvas text-fg hover:border-line-strong"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              aria-label="Next projects"
              className="grid size-10 place-items-center rounded-full bg-primary text-fg-inverse hover:bg-primary-hover"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
