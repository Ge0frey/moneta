"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { Chip } from "@/components/ui/pills";
import { EmptyState } from "@/components/ui/states";
import { STATUS_META, type ListingStatus } from "@/lib/listing";

const FILTERS: ("all" | ListingStatus)[] = ["all", "raising", "governing", "verdict", "redeemed"];

/**
 * Filters and scrolls the landing's project cards. The cards arrive already rendered on the server, so
 * this component (the only client code in the Ledger) needs no SDK or data fetching.
 */
export function LedgerCarousel({
  items,
  createCta,
}: {
  items: { id: string; status: ListingStatus; card: ReactNode }[];
  createCta: ReactNode;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const track = useRef<HTMLUListElement>(null);
  const shown = filter === "all" ? items : items.filter((l) => l.status === filter);

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

      {shown.length === 0 ? (
        <EmptyState
          className="border-dashed border-line-strong bg-transparent py-14"
          title={
            filter === "all"
              ? "No raises yet"
              : `Nothing ${STATUS_META[filter].label.toLowerCase()} right now`
          }
          body="Moneta is permissionless — the first raise could be yours."
          action={createCta}
        />
      ) : (
        <>
          <ul
            ref={track}
            className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:none]"
          >
            {shown.map((l) => (
              <li key={l.id} className="w-[min(340px,85vw)] shrink-0 snap-start">
                {l.card}
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
