"use client";

import {
  actionTitle,
  big,
  decodeAction,
  formatBps,
  formatCountdown,
  formatDuration,
  formatUsd,
  shortAddress,
} from "@moneta/sdk";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { Section } from "@/components/layout/Frame";
import { StatTile } from "@/components/ui/cards";
import { AddressChip, KV, PageHeader, Panel } from "@/components/ui/display";
import { Eyebrow, StatusChip, type StatusTone } from "@/components/ui/pills";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { CHAIN, CHAIN_ID, deployment, INDEXER_URL } from "@/lib/env";
import { useActiveProposals, useIndexerMeta, useProtocolStats } from "@/lib/hooks/indexed";
import { useChainNow, useFactoryState } from "@/lib/hooks/chain";

/** Liveness thresholds: indexer > 20 blocks behind warns, > 200 is critical; finalize overdue after 60s. */
const LAG_WARN = 20;
const LAG_CRIT = 200;
const OVERDUE = 60;

export function StatusView() {
  const client = usePublicClient() as PublicClient | undefined;
  const now = useChainNow();
  const head = useQuery({
    queryKey: ["chain", "status-head"],
    enabled: !!client,
    refetchInterval: 2_000,
    queryFn: async () => {
      const t0 = performance.now();
      const [latest, finalized] = await Promise.all([
        client!.getBlock({ blockTag: "latest" }),
        client!.getBlock({ blockTag: "finalized" }).catch(() => undefined),
      ]);
      return {
        latest: latest.number,
        finalized: finalized?.number,
        ms: Math.round(performance.now() - t0),
      };
    },
  });
  const meta = useIndexerMeta();
  const stats = useProtocolStats();
  const factory = useFactoryState();
  const active = useActiveProposals();

  const lag =
    head.data && meta.data ? Number(head.data.latest) - meta.data.progressBlock : undefined;
  const rpc: [StatusTone, string] = head.isError
    ? ["fail", "Unreachable"]
    : head.data
      ? ["pass", "Operational"]
      : ["muted", "Checking"];
  const idx: [StatusTone, string] = meta.isError
    ? ["fail", "Unreachable"]
    : lag === undefined
      ? ["muted", "Checking"]
      : lag > LAG_CRIT
        ? ["fail", `${lag} blocks behind`]
        : lag > LAG_WARN
          ? ["warning", `${lag} blocks behind`]
          : ["pass", "In sync"];
  const overdue = (active.data ?? []).filter(
    (p) => now !== undefined && p.tradingEnd && now > Number(p.tradingEnd) + OVERDUE,
  );
  const keeper: [StatusTone, string] = active.isError
    ? ["muted", "Unknown"]
    : overdue.length
      ? ["warning", `${overdue.length} overdue`]
      : ["pass", "On time"];
  const f = factory.data;
  const s = stats.data;

  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow className="w-fit">Status</Eyebrow>}
        title="Protocol Status"
        sub={`Live health of Moneta on ${CHAIN.name}: chain, indexer, keeper and protocol configuration, read directly from their sources.`}
      />
      <Section dense className="pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Health
            label="Chain RPC"
            status={rpc}
            detail={
              head.data ? `block ${head.data.latest.toLocaleString()} · ${head.data.ms} ms` : "—"
            }
          />
          <Health
            label="Finality"
            status={
              head.data?.finalized !== undefined
                ? ["pass", "Finalizing"]
                : head.data
                  ? ["muted", "No finalized tag"]
                  : ["muted", "Checking"]
            }
            detail={
              head.data?.finalized !== undefined
                ? `finalized ${head.data.finalized.toLocaleString()} · ${Number(head.data.latest - head.data.finalized)} behind head`
                : "—"
            }
          />
          <Health
            label="Indexer"
            status={idx}
            detail={
              meta.data
                ? `block ${meta.data.progressBlock.toLocaleString()}${meta.data.isReady ? "" : " · catching up"}`
                : INDEXER_URL
            }
          />
          <Health
            label="Keeper"
            status={keeper}
            detail={`${active.data?.length ?? 0} live proposal${active.data?.length === 1 ? "" : "s"}`}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Total Raised"
            value={
              s ? (
                formatUsd(big(s.totalRaised), 6, { compact: true })
              ) : (
                <Skeleton className="h-10 w-28" />
              )
            }
            sub={s ? `${s.raiseCount} raises · ${s.failedRaiseCount} refunded` : undefined}
          />
          <StatTile
            label="Treasuries"
            value={s ? s.projectCount : <Skeleton className="h-10 w-16" />}
            sub={s ? `${s.redeemedCount} redeemed` : undefined}
          />
          <StatTile
            label="Verdicts"
            value={s ? s.verdictsPassed + s.verdictsFailed : <Skeleton className="h-10 w-16" />}
            sub={s ? `▲ ${s.verdictsPassed} passed · ▼ ${s.verdictsFailed} failed` : undefined}
          />
          <StatTile
            label="Market Volume"
            value={
              s ? (
                formatUsd(big(s.volumeQuote), 6, { compact: true })
              ) : (
                <Skeleton className="h-10 w-28" />
              )
            }
            sub="spot + decision markets"
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-4">
          <div className="flex flex-col gap-4 lg:col-span-3">
            <Panel title="Live Verdicts">
              {active.isError ? (
                <ErrorState title="Couldn't load proposals" onRetry={() => active.refetch()} />
              ) : !active.data ? (
                <Skeleton className="h-24 w-full" />
              ) : active.data.length === 0 ? (
                <p className="body-sm text-fg-3">No proposals are trading right now.</p>
              ) : (
                <ol className="divide-y divide-line-strong border-y border-line-strong">
                  {active.data.map((p) => {
                    const end = Number(p.tradingEnd ?? 0);
                    const left = now !== undefined ? end - now : undefined;
                    let title = `Proposal #${p.proposalId}`;
                    try {
                      title = actionTitle(decodeAction(p.actionType, p.actionData));
                    } catch {}
                    return (
                      <li
                        key={p.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <div>
                          <Link
                            href={`/project/${p.project.treasury}/proposal/${p.proposalId}`}
                            className="body-sm text-fg hover:underline"
                          >
                            {title}
                          </Link>
                          <p className="mono-xs text-fg-3">
                            {p.project.name} · #{p.proposalId}
                          </p>
                        </div>
                        <span className="mono-sm tabular text-fg-2">
                          {left === undefined
                            ? "…"
                            : left > 0
                              ? `ends in ${formatCountdown(left)}`
                              : left > -OVERDUE
                                ? "finalizing"
                                : `overdue ${formatDuration(-left)}`}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Panel>

            <Panel title="Bounds For New Raises">
              {factory.isError ? (
                <ErrorState title="Couldn't read the factory" onRetry={() => factory.refetch()} />
              ) : !f ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <div className="grid gap-x-8 sm:grid-cols-2">
                  <KV
                    rows={[
                      [
                        "Raise window",
                        `${formatDuration(f.bounds.minRaiseWindow)} – ${formatDuration(f.bounds.maxRaiseWindow)}`,
                      ],
                      [
                        "Liquidity share",
                        `${formatBps(f.bounds.minLiquidityBps, { digits: 0 })} – ${formatBps(f.bounds.maxLiquidityBps, { digits: 0 })}`,
                      ],
                      ["Tranches", `≤ ${f.bounds.maxTranches}`],
                      ["Performance tranches", `≤ ${f.bounds.maxPerfTranches}`],
                      ["Finalize grace", formatDuration(f.bounds.finalizeGrace)],
                      ["Memo size", `≤ ${f.bounds.maxMemoBytes.toLocaleString()} bytes`],
                    ]}
                  />
                  <KV
                    rows={[
                      [
                        "Warm-up",
                        `${formatDuration(f.bounds.minWarmup)} – ${formatDuration(f.bounds.maxWarmup)}`,
                      ],
                      [
                        "Trading window",
                        `${formatDuration(f.bounds.minDuration)} – ${formatDuration(f.bounds.maxDuration)}`,
                      ],
                      [
                        "Thresholds",
                        `${formatBps(f.bounds.minTheta, { signed: true })} – ${formatBps(f.bounds.maxTheta, { signed: true })}`,
                      ],
                      [
                        "Liquidity per market",
                        `${formatBps(f.bounds.minProposalLiquidityBps, { digits: 0 })} – ${formatBps(f.bounds.maxProposalLiquidityBps, { digits: 0 })}`,
                      ],
                      [
                        "Oracle step",
                        `${f.bounds.minMaxStepBps} – ${f.bounds.maxMaxStepBps} bps/s`,
                      ],
                      [
                        "Mint per proposal",
                        `≤ ${formatBps(f.bounds.maxMintBps, { digits: 0 })} of supply`,
                      ],
                    ]}
                  />
                </div>
              )}
            </Panel>
          </div>

          <aside className="flex flex-col gap-4">
            <Panel title="Protocol">
              {!f ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <KV
                  rows={[
                    ["Network", `${CHAIN.name} · ${CHAIN_ID}`],
                    [
                      "New raises",
                      f.creationPaused ? (
                        <span className="text-warning">Paused</span>
                      ) : (
                        <span className="text-pass">Open</span>
                      ),
                    ],
                    ["Raise fee", formatBps(f.raiseFeeBps)],
                    ["Pool fee", formatBps(f.poolFeeBps)],
                    ["Fee recipient", shortAddress(f.feeRecipient)],
                    ["Raises created", f.raiseCount.toString()],
                  ]}
                />
              )}
            </Panel>
            <Panel title="Contracts">
              {deployment ? (
                <ul className="flex flex-col gap-2.5">
                  {(
                    [
                      ["Factory", deployment.factory],
                      ["AMM", deployment.amm],
                      ["Vault", deployment.vault],
                      ["Router", deployment.router],
                      ["Quote (USDC)", deployment.quote],
                    ] as const
                  ).map(([label, addr]) => (
                    <li key={label} className="flex items-center justify-between gap-2">
                      <span className="mono-xs text-fg-3 uppercase">{label}</span>
                      <AddressChip address={addr} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="body-sm text-fg-3">Not deployed on this network.</p>
              )}
            </Panel>
          </aside>
        </div>
      </Section>
    </>
  );
}

function Health({
  label,
  status: [tone, text],
  detail,
}: {
  label: string;
  status: [StatusTone, string];
  detail: string;
}) {
  return (
    <div className="flex min-h-[132px] flex-col justify-between rounded-[16px] border border-line-subtle bg-surface-1 p-5">
      <p className="mono-sm text-fg">{label}</p>
      <div>
        <StatusChip
          tone={tone}
          label={text}
          glyph={false}
          pulse={tone === "pass" ? false : undefined}
        />
        <p className="mono-xs mt-2 truncate text-fg-3">{detail}</p>
      </div>
    </div>
  );
}
