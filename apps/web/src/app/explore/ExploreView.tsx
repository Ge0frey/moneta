"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Section } from "@/components/layout/Frame";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/ui/cards";
import { PageHeader } from "@/components/ui/display";
import { Chip, Eyebrow } from "@/components/ui/pills";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useProjects, useRaises } from "@/lib/hooks/indexed";
import { buildListings, STATUS_META, type ListingStatus } from "@/lib/listing";

const FILTERS: ("all" | ListingStatus)[] = [
  "all",
  "raising",
  "governing",
  "verdict",
  "redeemed",
  "refunding",
];

export function ExploreView() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const status = (params.get("status") ?? "all") as (typeof FILTERS)[number];
  const q = (params.get("q") ?? "").trim().toLowerCase();
  const raises = useRaises();
  const projects = useProjects();

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
      <PageHeader
        eyebrow={<Eyebrow className="w-fit">Explore</Eyebrow>}
        title="Explore Raises"
        sub={
          q ? (
            <span>
              Results for <span className="text-fg">“{q}”</span> ·{" "}
              <Link href="/explore" className="underline underline-offset-2">
                clear
              </Link>
            </span>
          ) : (
            "Every Moneta raise and the market-governed treasuries they launched."
          )
        }
        actions={
          <Button asChild>
            <Link href="/create">Create a Raise</Link>
          </Button>
        }
      />
      <div className="-ml-1 flex flex-wrap gap-2 pb-6" role="group" aria-label="Filter by status">
        {FILTERS.map((f) => (
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
