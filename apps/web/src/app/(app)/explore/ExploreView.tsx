"use client";

import type { IndexedProject, IndexedRaise } from "@moneta/sdk";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Section } from "@/components/layout/Frame";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/ui/cards";
import { Chip } from "@/components/ui/pills";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useProjects, useRaises } from "@/lib/hooks/indexed";
import { buildListings, EXPLORE_FILTERS, STATUS_META } from "@/lib/listing";

/**
 * Interactive Explore: filters and search from the URL. The page header and the unfiltered list are
 * server-rendered by page.tsx (this view needs useSearchParams, so it only renders in the browser).
 */
export function ExploreView({
  initial,
}: {
  initial?: { raises: IndexedRaise[]; projects: IndexedProject[] };
}) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const status = (params.get("status") ?? "all") as (typeof EXPLORE_FILTERS)[number];
  const q = (params.get("q") ?? "").trim().toLowerCase();
  const raises = useRaises(initial?.raises);
  const projects = useProjects(initial?.projects);

  const listings = useMemo(() => {
    let l = buildListings(raises.data, projects.data);
    if (status !== "all") l = l.filter((x) => x.status === status);
    if (q) {
      l = l.filter(
        (x) =>
          x.raise.name.toLowerCase().includes(q) ||
          x.raise.symbol.toLowerCase().includes(q) ||
          x.raise.address.includes(q) ||
          x.project?.treasury.includes(q) ||
          x.project?.token.includes(q) ||
          x.raise.founder_id.includes(q),
      );
    }
    return l;
  }, [raises.data, projects.data, status, q]);

  const setStatus = (s: string) => {
    const next = new URLSearchParams(params);
    if (s === "all") next.delete("status");
    else next.set("status", s);
    router.replace(`${path}?${next.toString()}`, { scroll: false });
  };

  return (
    <>
      {q && (
        <p className="body -mt-6 pb-6 text-fg-2">
          Results for <span className="text-fg">“{q}”</span> ·{" "}
          <Link href="/explore" className="underline underline-offset-2">
            clear
          </Link>
        </p>
      )}
      <div className="-ml-1 flex flex-wrap gap-2 pb-6" role="group" aria-label="Filter by status">
        {EXPLORE_FILTERS.map((f) => (
          <Chip key={f} active={status === f} onClick={() => setStatus(f)}>
            {f === "all" ? "All" : STATUS_META[f].filter}
          </Chip>
        ))}
      </div>
      <Section ticks dense className="pb-24">
        {raises.isError ? (
          <ErrorState body="The indexer is unreachable." onRetry={() => raises.refetch()} />
        ) : raises.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-[260px] w-full rounded-[16px]" />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <EmptyState
            title={q ? "No matches" : "Nothing here yet"}
            body={
              q
                ? "Try a name, symbol or address."
                : "Moneta is permissionless — open the first raise."
            }
            action={
              <Button asChild variant="tertiary" size="sm">
                <Link href="/create">Create a raise</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <ProjectCard key={l.raise.id} l={l} />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
