"use client";

import {
  actionTitle,
  big,
  formatBps,
  formatDuration,
  formatScaledPrice,
  formatToken,
  formatUsd,
  ProposalStatus,
  scaledToNumber,
  shortAddress,
  spotPrice,
  txs,
  type IndexedPricePoint,
  type ProjectView,
  type ProposalAction,
  type ProposalView as PV,
} from "@moneta/sdk";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo } from "react";
import type { Address } from "viem";
import { Section } from "@/components/layout/Frame";
import { PriceChart, type ChartPoint } from "@/components/market/PriceChart";
import { Button } from "@/components/ui/button";
import {
  AddressChip,
  Countdown,
  Memo,
  PageHeader,
  Panel,
  PhaseTimeline,
} from "@/components/ui/display";
import { StatusChip, Tag } from "@/components/ui/pills";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { indexer } from "@/lib/env";
import { useChainNow, useProjectState, useProposalState } from "@/lib/hooks/chain";
import { INDEXER_POLL_MS } from "@/lib/hooks/indexed";
import { useMonetaTx } from "@/lib/hooks/tx";
import { MarketPanel, PositionsPanel, TradePanel, TradesPanel } from "./trade";

export function describeAction(a: ProposalAction, p: ProjectView): string {
  switch (a.type) {
    case "TrancheRelease":
      return `${formatUsd(p.tranches[a.index]?.amount ?? 0n)} to the founder for milestone ${a.index + 1}`;
    case "Transfer":
      return `${a.token.toLowerCase() === p.quote.toLowerCase() ? formatUsd(a.amount) : formatToken(a.amount, 18)} to ${shortAddress(a.to)}`;
    case "SetBudget":
      return `${formatUsd(p.budgetPerMonth)} → ${formatUsd(a.perMonth)} per month`;
    case "Mint":
      return `${formatToken(a.amount, 18, p.tokenMeta.symbol)} to ${shortAddress(a.to)}`;
    case "Buyback":
      return `Spend ${formatUsd(a.quoteIn)} buying and burning ${p.tokenMeta.symbol}`;
    case "UpdateConfig":
      return `Warm-up ${formatDuration(a.config.warmup)} · trading ${formatDuration(a.config.duration)} · θ community ${formatBps(a.config.thetaCommunityBps, { signed: true })}`;
    case "SetFounder":
      return `Founder → ${shortAddress(a.founder)}`;
    case "Call":
      return `Call ${shortAddress(a.target)} (${(a.data.length - 2) / 2} bytes)`;
    case "Redeem":
      return "Wind down: return the treasury to holders pro-rata (exit at NAV)";
  }
}

const STATUS: Record<
  number,
  { tone: "live" | "pass" | "fail" | "warning" | "muted"; label: string }
> = {
  [ProposalStatus.Queued]: { tone: "warning", label: "Queued" },
  [ProposalStatus.Active]: { tone: "live", label: "Live" },
  [ProposalStatus.Passed]: { tone: "pass", label: "Passed" },
  [ProposalStatus.Failed]: { tone: "fail", label: "Failed" },
  [ProposalStatus.Executed]: { tone: "pass", label: "Executed" },
  [ProposalStatus.Cancelled]: { tone: "muted", label: "Cancelled" },
};

export function ProposalView({ treasury, id }: { treasury: Address; id: bigint }) {
  const project = useProjectState(treasury);
  const chain = useProposalState(project.data, id);
  const tx = useMonetaTx();
  const now = useChainNow();
  const indexed = useQuery({
    queryKey: ["idx", "proposal", treasury, id.toString()],
    queryFn: () => indexer.proposal(treasury, id),
    refetchInterval: INDEXER_POLL_MS,
  });
  const passPts = useQuery({
    queryKey: ["idx", "points", chain.data?.proposal.passPoolId.toString()],
    enabled: !!chain.data?.passPool,
    queryFn: () => indexer.pricePoints(chain.data!.proposal.passPoolId),
    refetchInterval: INDEXER_POLL_MS,
  });
  const failPts = useQuery({
    queryKey: ["idx", "points", chain.data?.proposal.failPoolId.toString()],
    enabled: !!chain.data?.failPool,
    queryFn: () => indexer.pricePoints(chain.data!.proposal.failPoolId),
    refetchInterval: INDEXER_POLL_MS,
  });

  if (project.isError || chain.isError)
    return <ErrorState className="mt-12" title="Proposal not found" />;
  if (!project.data || !chain.data)
    return <Skeleton className="mt-12 h-[560px] w-full rounded-[16px]" />;

  const p = project.data;
  const v = chain.data;
  const pr = v.proposal;
  if (pr.status === ProposalStatus.None)
    return (
      <ErrorState
        className="mt-12"
        title="Proposal not found"
        body={`Proposal #${id} doesn't exist yet.`}
      />
    );
  const status = STATUS[pr.status]!;
  const live = pr.status === ProposalStatus.Active;
  const ended = now !== undefined && now >= pr.tradingEnd;
  const inWarmup = now !== undefined && now < pr.tradingStart;
  const executedOk = pr.status === ProposalStatus.Executed;
  const phase =
    pr.status === ProposalStatus.Queued
      ? -1
      : live
        ? inWarmup
          ? 0
          : ended
            ? 2
            : 1
        : executedOk
          ? 3
          : 2;
  const proj = v.projection;
  const premium = proj?.premiumBps ?? 0;
  const lead = premium >= 0 ? "PASS" : "FAIL";

  return (
    <>
      <PageHeader
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip
              tone={status.tone}
              label={
                indexed.data?.executionFailed && pr.status === ProposalStatus.Passed
                  ? "Passed · execution failed"
                  : status.label
              }
              pulse={live}
            />
            <Tag>#{id.toString()}</Tag>
            <Tag>
              {pr.isTeam ? "Team" : "Community"} · threshold{" "}
              {formatBps(pr.thetaBps, { signed: true })}
            </Tag>
          </div>
        }
        title={actionTitle(v.action)}
        sub={
          <span className="flex flex-col gap-2">
            <span>{describeAction(v.action, p)}</span>
            <span className="inline-flex flex-wrap items-center gap-3">
              <Link href={`/project/${treasury}`} className="mono-xs text-fg-2 hover:text-fg">
                ← {p.tokenMeta.name}
              </Link>
              <AddressChip address={pr.proposer} label="Proposer" />
            </span>
          </span>
        }
        actions={
          <>
            {live && ended && (
              <Button
                variant="accent"
                onClick={() =>
                  tx.run({
                    title: `Finalize proposal #${id}`,
                    request: txs.finalizeProposal(treasury, id),
                  })
                }
              >
                Finalize verdict
              </Button>
            )}
            {pr.status === ProposalStatus.Passed && (
              <Button
                variant="tertiary"
                onClick={() =>
                  tx.run({
                    title: `Execute proposal #${id}`,
                    request: txs.executeProposal(treasury, id),
                  })
                }
              >
                Retry execution
              </Button>
            )}
          </>
        }
      />
      <Section dense className="pb-24">
        {pr.status === ProposalStatus.Queued ? (
          <Panel>
            <p className="body text-fg-2">
              This Redemption is queued behind the active proposal and opens its markets
              automatically when that proposal is finalized. No other proposal can start while it
              waits.
            </p>
          </Panel>
        ) : (
          <div className="grid gap-4 lg:grid-cols-4">
            <div className="flex flex-col gap-4 lg:col-span-3">
              <Panel>
                <div className="mb-6 grid gap-6 sm:grid-cols-3">
                  <div>
                    <p className="mono-xs text-fg-3 uppercase">
                      {live ? "Projected verdict" : "Verdict"}
                    </p>
                    <p className={`figure-xl mt-2 ${proj?.passing ? "text-fg" : "text-fg"}`}>
                      {proj?.passing ? "▲ PASS" : "▼ FAIL"}
                    </p>
                    <p className="mono-xs mt-2 text-fg-3">
                      {lead} {live ? "leads" : "led"} by {formatBps(Math.abs(premium))} · needs{" "}
                      {formatBps(pr.thetaBps, { signed: true })}
                    </p>
                  </div>
                  <div>
                    <p className="mono-xs text-fg-3 uppercase">TWAP · PASS / FAIL</p>
                    <p className="figure-lg mt-2">
                      {proj ? formatScaledPrice(proj.twapPass) : "—"}
                    </p>
                    <p className="figure-lg text-fg-2">
                      {proj ? formatScaledPrice(proj.twapFail) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="mono-xs text-fg-3 uppercase">
                      {live ? (inWarmup ? "TWAP starts in" : "Verdict in") : "Decided"}
                    </p>
                    <div className="mt-2">
                      {live ? (
                        <Countdown
                          to={inWarmup ? pr.tradingStart : pr.tradingEnd}
                          label={inWarmup ? "warm-up · not counted" : "trading window"}
                          done="Ready to finalize"
                        />
                      ) : (
                        <p className="figure-lg">
                          {new Date(pr.tradingEnd * 1000).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <VerdictChart
                  v={v}
                  passPts={passPts.data}
                  failPts={failPts.data}
                  now={now}
                  symbol={p.tokenMeta.symbol}
                />
              </Panel>
              <PhaseTimeline
                current={phase}
                phases={[
                  {
                    label: "Warm-up",
                    sub: `${formatDuration(pr.tradingStart - pr.createdAt)} · prices form`,
                  },
                  {
                    label: "Trading",
                    sub: `${formatDuration(pr.tradingEnd - pr.tradingStart)} · TWAP counts`,
                  },
                  {
                    label: "Verdict",
                    sub:
                      pr.status === ProposalStatus.Failed
                        ? "▼ FAIL · capital stays"
                        : pr.status >= ProposalStatus.Passed
                          ? "▲ PASS"
                          : "anyone can finalize",
                  },
                  { label: "Executed", sub: executedOk ? "on-chain, no signer" : "on PASS only" },
                ]}
              />
              <Panel title="Proposal memo">
                {indexed.data ? (
                  <Memo text={indexed.data.memo || "_No memo._"} hash={pr.memoHash} />
                ) : (
                  <Skeleton className="h-24 w-full" />
                )}
              </Panel>
              <TradesPanel trades={indexed.data?.trades} />
            </div>
            <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
              {live && !ended ? <TradePanel project={p} view={v} /> : null}
              <PositionsPanel project={p} view={v} />
              <MarketPanel
                project={p}
                view={v}
                indexed={indexed.data ?? undefined}
                awaitingFinalize={live && ended}
              />
            </aside>
          </div>
        )}
      </Section>
    </>
  );
}

/** Decision-market chart: TWAP solid, spot faint, PASS threshold dashed. */
function VerdictChart({
  v,
  passPts,
  failPts,
  now,
  symbol,
}: {
  v: PV;
  passPts?: IndexedPricePoint[];
  failPts?: IndexedPricePoint[];
  now?: number;
  symbol: string;
}) {
  const series = useMemo(() => {
    const pr = v.proposal;
    const start = pr.tradingStart;
    const created = pr.createdAt;
    const twapSeries = (
      pts: IndexedPricePoint[] | undefined,
      liveTwap: bigint | undefined,
      startObs: number,
    ): ChartPoint[] => {
      const out: ChartPoint[] = [{ time: created, value: startObs }];
      for (const x of pts ?? []) {
        if (x.kind !== "OBSERVATION") continue;
        const t = Number(x.timestamp);
        const value =
          t > start && big(x.cumulative) > 0n
            ? scaledToNumber(big(x.cumulative) / BigInt(t - start))
            : scaledToNumber(big(x.observation));
        out.push({ time: t, value });
      }
      if (liveTwap !== undefined && now !== undefined)
        out.push({ time: Math.min(now, pr.tradingEnd), value: scaledToNumber(liveTwap) });
      return out;
    };
    const spotSeries = (pts: IndexedPricePoint[] | undefined, startObs: number): ChartPoint[] => [
      { time: created, value: startObs },
      ...(pts ?? [])
        .filter((x) => x.kind === "SPOT" && big(x.price) > 0n)
        .map((x) => ({ time: Number(x.timestamp), value: scaledToNumber(big(x.price)) })),
    ];
    // both pools open at exactly the spot price the treasury migrated liquidity at
    const startObs =
      pr.migratedBase > 0n ? scaledToNumber(spotPrice(pr.migratedBase, pr.migratedQuote)) : 0;
    const passTwap = twapSeries(passPts, v.projection?.twapPass, startObs);
    const failTwap = twapSeries(failPts, v.projection?.twapFail, startObs);
    const threshold = failTwap.map((p) => ({
      time: p.time,
      value: p.value * (1 + pr.thetaBps / 10_000),
    }));
    return [
      {
        id: "pass-twap",
        label: "PASS TWAP",
        glyph: "▲",
        color: "#1dae84",
        style: "solid" as const,
        data: passTwap,
      },
      {
        id: "fail-twap",
        label: "FAIL TWAP",
        glyph: "▼",
        color: "#ec5a3c",
        style: "solid" as const,
        data: failTwap,
      },
      {
        id: "pass-spot",
        label: "PASS spot",
        color: "#1dae84",
        style: "faint" as const,
        data: spotSeries(passPts, startObs),
      },
      {
        id: "fail-spot",
        label: "FAIL spot",
        color: "#ec5a3c",
        style: "faint" as const,
        data: spotSeries(failPts, startObs),
      },
      {
        id: "threshold",
        label: `PASS line ${formatBps(pr.thetaBps, { signed: true })}`,
        color: "#8a8a8a",
        style: "dashed" as const,
        data: threshold,
      },
    ];
  }, [v, passPts, failPts, now]);
  return (
    <PriceChart
      series={series}
      height={320}
      ariaLabel={`${symbol} price in the PASS and FAIL worlds over the decision window`}
    />
  );
}
