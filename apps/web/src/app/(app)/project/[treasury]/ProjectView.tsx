"use client";

import {
  actionTitle,
  big,
  decodeAction,
  formatBps,
  formatScaledPrice,
  formatToken,
  formatTokenPrice,
  formatUsd,
  ProjectState,
  raisePriceToScaled,
  scaledToNumber,
  spotPrice,
  type ProjectView as Project,
} from "@moneta/sdk";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo } from "react";
import type { Address } from "viem";
import { Section } from "@/components/layout/Frame";
import { PriceChart } from "@/components/market/PriceChart";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/cards";
import { AddressChip, PageHeader, Panel } from "@/components/ui/display";
import { StatusChip, Tag } from "@/components/ui/pills";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { indexer, quoteSym } from "@/lib/env";
import { useChainNow, useProjectState } from "@/lib/hooks/chain";
import { INDEXER_POLL_MS } from "@/lib/hooks/indexed";
import { proposalHref, proposeHref, raiseHref } from "@/lib/listing";
import { clampText, isTemplateMemo, memoThesis, plainText } from "@/lib/seo";
import type { ProjectDetail, ProposalRow, RaiseDetail } from "@/lib/server/data";
import { FounderPanel, RedemptionPanel, SwapPanel } from "./panels";

const PROPOSAL_TONE = {
  QUEUED: ["warning", "Queued"],
  ACTIVE: ["live", "Live"],
  PASSED: ["pass", "Passed"],
  EXECUTED: ["pass", "Executed"],
  FAILED: ["fail", "Failed"],
  CANCELLED: ["muted", "Cancelled"],
} as const;

/** Server-rendered indexer data for the first paint (what crawlers and link previews see). */
export type ProjectInitial = {
  project: ProjectDetail | null;
  proposals: ProposalRow[] | null;
  raise: RaiseDetail | null;
};

export function ProjectView({
  treasury,
  initial,
}: {
  treasury: Address;
  initial?: ProjectInitial;
}) {
  const chain = useProjectState(treasury);
  const indexed = useQuery({
    queryKey: ["idx", "project", treasury],
    queryFn: () => indexer.project(treasury),
    refetchInterval: INDEXER_POLL_MS,
    initialData: initial?.project ?? undefined,
  });
  const proposals = useQuery({
    queryKey: ["idx", "proposals", treasury],
    queryFn: () => indexer.proposals(treasury),
    refetchInterval: INDEXER_POLL_MS,
    initialData: initial?.proposals ?? undefined,
  });
  const raiseId = indexed.data?.raise_id;
  const raiseMeta = useQuery({
    queryKey: ["idx", "raise", raiseId],
    enabled: !!raiseId,
    queryFn: () => indexer.raise(raiseId!),
    staleTime: Infinity, // the memo is immutable; no polling
    initialData: initial?.raise ?? undefined,
  });
  const points = useQuery({
    queryKey: ["idx", "points", chain.data?.spotPoolId.toString()],
    enabled: !!chain.data,
    queryFn: () => indexer.pricePoints(chain.data!.spotPoolId),
    refetchInterval: INDEXER_POLL_MS,
  });
  const memo = raiseMeta.data?.memo ?? "";
  const thesis = memo && !isTemplateMemo(memo) ? clampText(memoThesis(memo), 240) : "";

  if (chain.isError && !indexed.data)
    return (
      <ErrorState
        className="mt-12"
        title="Project not found"
        body="This address isn't a Moneta treasury on this network."
      />
    );
  if (!chain.data)
    return indexed.data ? (
      <ProjectSummary
        treasury={treasury}
        project={indexed.data}
        proposals={proposals.data ?? undefined}
        raise={raiseMeta.data ?? undefined}
        thesis={thesis}
      />
    ) : (
      <Skeleton className="mt-12 h-[520px] w-full rounded-[16px]" />
    );
  const p = chain.data;
  const redeemed = p.state === ProjectState.Redeemed;
  const spot =
    p.spot.reserveBase > 0n
      ? spotPrice(p.spot.reserveBase, p.spot.reserveQuote)
      : big(indexed.data?.lastPrice);
  const raiseScaled = raisePriceToScaled(p.raisePrice);
  const sym = p.tokenMeta.symbol;
  const qSym = quoteSym(p.quote);

  return (
    <>
      <PageHeader
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            {redeemed ? (
              <StatusChip tone="muted" label="Redeemed" pulse={false} />
            ) : p.activeProposalId > 0n ? (
              <StatusChip tone="live" label="In Verdict" />
            ) : (
              <StatusChip tone="live" label="Governing" pulse={false} />
            )}
            <Tag>${sym}</Tag>
            <Tag>{qSym}</Tag>
            {indexed.data && <Tag>{indexed.data.holderCount} holders</Tag>}
          </div>
        }
        title={p.tokenMeta.name}
        sub={
          <span className="flex flex-col gap-3">
            {thesis && <span>{thesis}</span>}
            <span className="inline-flex flex-wrap items-center gap-3">
              <AddressChip address={p.founder} label="Founder" />
              <AddressChip address={treasury} label="Treasury" />
              <AddressChip address={p.token} label="Token" />
              <Link href={raiseHref(p.raise)} className="mono-xs text-fg-3 hover:text-fg">
                Raise memo →
              </Link>
            </span>
          </span>
        }
        actions={
          !redeemed && (
            <Button asChild>
              <Link href={proposeHref(treasury)}>New proposal</Link>
            </Button>
          )
        }
      />
      <Section dense className="pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Spot Price"
            value={formatScaledPrice(spot)}
            sub={`raise price ${formatTokenPrice(p.raisePrice)}`}
          />
          <StatTile
            label="NAV / Token"
            value={formatTokenPrice(p.nav.navPerToken)}
            sub={`${formatUsd(p.nav.quoteAssets, 6, { compact: true })} backing ${formatToken(p.nav.circulating, 18)} ${sym}`}
          />
          <StatTile
            label="Treasury"
            value={formatUsd(p.availableQuote, 6, { compact: true })}
            sub={p.bondsHeld > 0n ? `+ ${formatUsd(p.bondsHeld)} bonds held` : `available ${qSym}`}
          />
          <StatTile
            label="Budget / Month"
            value={formatUsd(p.budgetPerMonth, 6, { compact: true })}
            sub={redeemed ? "stopped" : `${formatUsd(p.budgetAccrued)} accrued`}
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-4">
          <div className="flex flex-col gap-4 lg:col-span-3">
            <Panel title="Spot Market">
              <SpotChart project={p} points={points.data} raiseScaled={raiseScaled} />
            </Panel>
            <Panel title="Milestone Tranches">
              {p.tranches.length === 0 ? (
                <p className="body-sm text-fg-3">No tranches configured.</p>
              ) : (
                <ol className="grid border-t border-l border-line-strong sm:grid-cols-2 lg:grid-cols-4">
                  {p.tranches.map((t, i) => (
                    <li key={i} className="border-r border-b border-line-strong">
                      <div className="flex min-h-[120px] flex-col justify-between p-4">
                        <p className="body-sm">Tranche {i + 1}</p>
                        <div>
                          <p className="figure-lg">{formatUsd(t.amount, 6, { compact: true })}</p>
                          <p className="mono-xs mt-1 text-fg-3">
                            {formatBps(t.bps, { digits: 0 })} of launch treasury
                          </p>
                        </div>
                      </div>
                      <p
                        className={`mono-xs border-t border-line-strong bg-surface-2 px-4 py-2.5 ${t.released ? "text-pass" : "text-fg-3"}`}
                      >
                        {t.released ? "▲ Released by verdict" : "Locked · needs PASS"}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
            <Panel
              title="Proposals"
              action={
                !redeemed && (
                  <Button asChild variant="tertiary" size="sm">
                    <Link href={proposeHref(treasury)}>New proposal</Link>
                  </Button>
                )
              }
            >
              <ProposalsTable
                treasury={treasury}
                proposals={proposals.data ?? undefined}
                loading={proposals.isLoading}
              />
            </Panel>
            <Panel title="Treasury Flows">
              {!indexed.data?.flows.length ? (
                <p className="body-sm text-fg-3">No flows yet.</p>
              ) : (
                <ol className="divide-y divide-line-strong border-y border-line-strong">
                  {indexed.data.flows.slice(0, 20).map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="mono-xs text-fg-2">
                        {f.kind.replace(/_/g, " ").toLowerCase()}
                      </span>
                      <span className="body-sm tabular">
                        {f.kind === "MINT" || f.kind === "PERF_UNLOCK"
                          ? formatToken(big(f.amount), 18, sym)
                          : formatUsd(big(f.amount))}
                      </span>
                      <span className="mono-xs hidden text-fg-3 sm:inline">
                        {new Date(Number(f.timestamp) * 1000).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>
          <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
            {redeemed ? <RedemptionPanel project={p} /> : <SwapPanel project={p} />}
            <FounderPanel project={p} />
          </aside>
        </div>
      </Section>
    </>
  );
}

function ProposalsTable({
  treasury,
  proposals,
  loading,
}: {
  treasury: Address;
  proposals?: ProposalRow[];
  loading?: boolean;
}) {
  if (loading && !proposals) return <Skeleton className="h-32 w-full" />;
  if (!proposals?.length)
    return (
      <EmptyState
        motif="fork"
        title="No proposals yet"
        body="Every spend beyond the budget starts here — and ends in a verdict."
        className="border-0 bg-transparent"
      />
    );
  return (
    <table className="w-full">
      <thead>
        <tr className="mono-xs text-fg-3 uppercase">
          <th className="py-2 text-left font-normal">#</th>
          <th className="py-2 text-left font-normal">Proposal</th>
          <th className="py-2 text-left font-normal">Status</th>
          <th className="hidden py-2 text-right font-normal sm:table-cell">PASS premium</th>
        </tr>
      </thead>
      <tbody>
        {proposals.map((pr) => {
          const [tone, label] = PROPOSAL_TONE[pr.status];
          const premium =
            pr.twapPass && pr.twapFail && big(pr.twapFail) > 0n
              ? Number(((big(pr.twapPass) - big(pr.twapFail)) * 10_000n) / big(pr.twapFail))
              : undefined;
          let title = "Proposal";
          try {
            title = actionTitle(decodeAction(pr.actionType, pr.actionData));
          } catch {}
          return (
            <tr key={pr.id} className="border-t border-line-strong">
              <td className="py-3 pr-3 mono-xs text-fg-3">{pr.proposalId}</td>
              <td className="py-3 pr-3">
                <Link
                  href={proposalHref(treasury, pr.proposalId)}
                  className="body-sm text-fg hover:underline"
                >
                  {title}
                </Link>
                <p className="mono-xs mt-0.5 line-clamp-1 text-fg-3">
                  {memoThesis(pr.memo) || plainText(pr.memo)}
                </p>
              </td>
              <td className="py-3 pr-3">
                <StatusChip
                  tone={tone}
                  label={pr.executionFailed && pr.status === "PASSED" ? "Exec failed" : label}
                  pulse={pr.status === "ACTIVE"}
                />
              </td>
              <td className="hidden py-3 text-right body-sm tabular sm:table-cell">
                {premium === undefined ? "—" : formatBps(premium, { signed: true })}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * First paint from the indexer, before the chain read lands: name, thesis, figures and every proposal,
 * linked. Live prices, NAV and the trade/founder panels replace it as soon as the chain read arrives.
 */
function ProjectSummary({
  treasury,
  project,
  proposals,
  raise,
  thesis,
}: {
  treasury: Address;
  project: ProjectDetail;
  proposals?: ProposalRow[];
  raise?: RaiseDetail;
  thesis: string;
}) {
  const redeemed = project.state === "REDEEMED";
  const sym = project.symbol;
  const price =
    big(project.lastPrice) > 0n
      ? formatScaledPrice(big(project.lastPrice))
      : raise
        ? formatTokenPrice(big(raise.price))
        : "—";
  return (
    <>
      <PageHeader
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            {redeemed ? (
              <StatusChip tone="muted" label="Redeemed" pulse={false} />
            ) : project.activeProposal_id ? (
              <StatusChip tone="live" label="In Verdict" />
            ) : (
              <StatusChip tone="live" label="Governing" pulse={false} />
            )}
            <Tag>${sym}</Tag>
            {raise && <Tag>{quoteSym(raise.quote)}</Tag>}
            <Tag>{project.holderCount} holders</Tag>
          </div>
        }
        title={project.name}
        sub={
          <span className="flex flex-col gap-3">
            {thesis && <span>{thesis}</span>}
            <span className="inline-flex flex-wrap items-center gap-3">
              <AddressChip address={project.founder} label="Founder" />
              <AddressChip address={treasury} label="Treasury" />
              <AddressChip address={project.token} label="Token" />
              <Link href={raiseHref(project.raise_id)} className="mono-xs text-fg-3 hover:text-fg">
                Raise memo →
              </Link>
            </span>
          </span>
        }
      />
      <Section dense className="pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Last Price"
            value={price}
            sub={raise ? `raise price ${formatTokenPrice(big(raise.price))}` : undefined}
          />
          <StatTile
            label="Treasury at Launch"
            value={formatUsd(big(project.treasuryQuoteAtLaunch), 6, { compact: true })}
            sub={`${formatUsd(big(project.releasedQuote), 6, { compact: true })} released since`}
          />
          <StatTile label="Holders" value={project.holderCount} sub={`$${sym}`} />
          <StatTile
            label="Proposals"
            value={proposals?.length ?? project.proposalCount}
            sub="each settled by PASS/FAIL markets"
          />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-4">
          <div className="flex flex-col gap-4 lg:col-span-3">
            <Panel title="Proposals">
              <ProposalsTable treasury={treasury} proposals={proposals} />
            </Panel>
          </div>
          <aside className="flex flex-col gap-4">
            <Skeleton className="h-[320px] w-full rounded-[16px]" />
          </aside>
        </div>
      </Section>
    </>
  );
}

function SpotChart({
  project,
  points,
  raiseScaled,
}: {
  project: Project;
  points?: { kind: string; timestamp: string; price: string; observation: string }[];
  raiseScaled: bigint;
}) {
  const tick = useChainNow();
  const chainNow = tick === undefined ? undefined : Math.floor(tick / 5) * 5; // refresh the live point every 5s
  const series = useMemo(() => {
    const spot = (points ?? [])
      .filter((x) => big(x.price) > 0n)
      .map((x) => ({ time: Number(x.timestamp), value: scaledToNumber(big(x.price)) }));
    const start = project.launchedAt;
    // chain time (not the viewer's clock), so the live point lands after the latest indexed swap
    const now = chainNow ?? Math.floor(Date.now() / 1000);
    const live =
      project.spot.reserveBase > 0n
        ? scaledToNumber(spotPrice(project.spot.reserveBase, project.spot.reserveQuote))
        : undefined;
    const data = [
      { time: start, value: scaledToNumber(raiseScaled) },
      ...spot,
      ...(live ? [{ time: now, value: live }] : []),
    ];
    return [
      {
        id: "spot",
        label: `${project.tokenMeta.symbol} spot`,
        color: "#8b7bf2",
        style: "solid" as const,
        data,
      },
      {
        id: "raise",
        label: "Raise price",
        color: "#8a8a8a",
        style: "dashed" as const,
        data: [
          { time: start, value: scaledToNumber(raiseScaled) },
          { time: Math.max(now, start + 1), value: scaledToNumber(raiseScaled) },
        ],
      },
    ];
  }, [points, project, raiseScaled, chainNow]);
  return (
    <PriceChart
      series={series}
      height={280}
      ariaLabel={`${project.tokenMeta.symbol} spot price over time`}
    />
  );
}
