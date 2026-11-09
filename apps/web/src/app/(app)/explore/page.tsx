import Link from "next/link";
import { Suspense } from "react";
import { Frame, Section } from "@/components/layout/Frame";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/ui/cards";
import { PageHeader } from "@/components/ui/page-header";
import { Chip, Eyebrow } from "@/components/ui/pills";
import { Skeleton } from "@/components/ui/states";
import { EXPLORE_FILTERS, STATUS_META, type Listing } from "@/lib/listing";
import { pageMetadata } from "@/lib/seo";
import { getIndexedLists, getListings } from "@/lib/server/data";
import { ExploreView } from "./ExploreView";

/** Every ?status= / ?q= / utm variant canonicalizes here; internal search results stay out of the index. */
export const metadata = pageMetadata({
  title: "Explore Raises and Decision Markets on Monad",
  description:
    "Browse every Moneta raise on Monad: open raises, launched projects with market-governed treasuries, live PASS/FAIL markets and redeemed treasuries.",
  path: "/explore",
});

export const revalidate = 60;

export default async function ExplorePage() {
  const [lists, listings] = await Promise.all([getIndexedLists(), getListings()]);
  return (
    <Frame>
      <PageHeader
        eyebrow={<Eyebrow className="w-fit">Explore</Eyebrow>}
        title="Explore Raises"
        sub="Every Moneta raise and the market-governed treasuries they launched."
        actions={
          <Button asChild>
            <Link href="/create">Create a Raise</Link>
          </Button>
        }
      />
      <Suspense fallback={<ServerListing listings={listings} />}>
        <ExploreView initial={lists ?? undefined} />
      </Suspense>
    </Frame>
  );
}

/**
 * The unfiltered list as plain HTML: what crawlers and link previews see, and the first paint before the
 * interactive view (which reads ?status= and ?q= from the URL) takes over.
 */
function ServerListing({ listings }: { listings: Listing[] | null }) {
  return (
    <>
      <div className="-ml-1 flex flex-wrap gap-2 pb-6" aria-hidden>
        {EXPLORE_FILTERS.map((f) => (
          <Chip key={f} active={f === "all"}>
            {f === "all" ? "All" : STATUS_META[f].filter}
          </Chip>
        ))}
      </div>
      <Section ticks dense className="pb-24">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {listings
            ? listings.map((l) => <ProjectCard key={l.raise.id} l={l} />)
            : [0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-[260px] w-full rounded-[16px]" />
              ))}
        </div>
      </Section>
    </>
  );
}
