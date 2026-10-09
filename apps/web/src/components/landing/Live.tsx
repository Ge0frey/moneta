"use client";

import { big, formatUsd } from "@moneta/sdk";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/ui/cards";
import { Chip, LiveDot } from "@/components/ui/pills";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { deployment } from "@/lib/env";
import { useProjects, useProtocolStats, useRaises } from "@/lib/hooks/indexed";
import { buildListings, STATUS_META, type ListingStatus } from "@/lib/listing";
import { cn } from "@/lib/cn";
import { SectionHead } from "./SectionHead";

/* ── Figures: one hairline row, one figure per frame column ────────────────── */
function Figure({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: ReactNode;
  sub: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[148px] flex-col justify-between gap-6 border-line py-6 lg:min-h-[176px]",
        className,
      )}
    >
      <p className="label-mono text-fg-3">{label}</p>
      <div>
        <div className="figure-xl">{value}</div>
        <p className="mono-xs mt-2 text-fg-3">{sub}</p>
      </div>
    </div>
  );
}

function Figures() {
  const { data, isLoading, isError, refetch } = useProtocolStats();
  if (isError) return <ErrorState body="The indexer is unreachable." onRetry={() => refetch()} />;
  const v = (x: ReactNode) => (isLoading ? <Skeleton className="h-10 w-24" /> : x);
  const passed = data?.verdictsPassed ?? 0;
  const failed = data?.verdictsFailed ?? 0;
  return (
    <div className="grid grid-cols-2 border-y border-line lg:grid-cols-4">
      <Figure
        className="border-b pr-4 sm:pr-6 lg:border-b-0"
        label="Total raised"
        value={v(formatUsd(big(data?.totalRaised), 6, { compact: true }))}
        sub={`${deployment?.testQuote ? "USDC + mUSDC" : "USDC"} accepted at launch`}
      />
      <Figure
        className="border-b pl-4 sm:px-6 lg:border-b-0"
        label="Treasuries governed"
        value={v(data?.projectCount ?? 0)}
        sub={`${data?.redeemedCount ?? 0} redeemed at NAV`}
      />
      <Figure
        className="pr-4 sm:pr-6 lg:px-6"
        label="Verdicts reached"
        value={v(passed + failed)}
        sub={`▲ ${passed} PASS · ▼ ${failed} FAIL`}
      />
      <Figure
        className="pl-4 sm:px-6"
        label="Block time"
        value="300 ms"
        sub="Monad · ~600 ms finality"
      />
    </div>
  );
}

/* ── Listings: filters + carousel ──────────────────────────────────────────── */
const FILTERS: ("all" | ListingStatus)[] = ["all", "raising", "governing", "verdict", "redeemed"];

function Listings() {
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
    <div className="flex flex-col gap-6">
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
          className="border-dashed border-line-strong bg-transparent py-14"
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

/** V. Ledger — protocol figures and live projects, straight from the indexer. */
export function Ledger() {
  return (
    <div className="flex flex-col gap-16">
      <SectionHead n="V" label="Ledger" title="On the ledger.">
        <p className="body-lg text-fg-2">
          <LiveDot tone="live" className="mr-3 align-middle" />
          Every figure is read from the chain&apos;s indexer as blocks land.
        </p>
      </SectionHead>
      <Figures />
      <Listings />
    </div>
  );
}
