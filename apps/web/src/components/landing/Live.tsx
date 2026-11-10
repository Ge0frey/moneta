import { big, formatUsd } from "@moneta/sdk";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/ui/cards";
import { LiveDot } from "@/components/ui/pills";
import { cn } from "@/lib/cn";
import { deployment } from "@/lib/env";
import { getListings, getProtocol } from "@/lib/server/data";
import { AutoRefresh } from "./AutoRefresh";
import { LedgerCarousel } from "./LedgerCarousel";
import { SectionHead } from "./SectionHead";

/*
 * Server-rendered: the figures and the project cards are in the landing page's HTML (real numbers, real
 * links to every live raise), and the landing ships no SDK, viem or React Query. The page is ISR and
 * AutoRefresh re-pulls it every minute while the tab is visible, so the figures stay current.
 */

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

async function Figures() {
  const data = await getProtocol();
  const v = (x: ReactNode) => (data ? x : "—");
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

async function Listings() {
  const listings = await getListings();
  if (!listings)
    return (
      <div className="rounded-[16px] border border-dashed border-line-strong px-6 py-14 text-center">
        <p className="body text-fg-2">The indexer is unreachable right now.</p>
        <Link href="/explore" className="mono-sm mt-3 inline-block text-fg hover:underline">
          Try Explore →
        </Link>
      </div>
    );
  return (
    <LedgerCarousel
      items={listings.map((l) => ({
        id: l.raise.id,
        status: l.status,
        card: <ProjectCard l={l} />,
      }))}
      createCta={
        <Button asChild variant="tertiary" size="sm">
          <Link href="/create">Create a raise</Link>
        </Button>
      }
    />
  );
}

/** V. Ledger — protocol figures and live projects, straight from the indexer. */
export function Ledger() {
  return (
    <div className="flex flex-col gap-16">
      <AutoRefresh everyMs={60_000} />
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
