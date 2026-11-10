"use client";

import {
  formatBps,
  formatDuration,
  formatToken,
  formatTokenPrice,
  formatUsd,
  RaiseStatus,
  shortAddress,
  tokensForQuote,
  txs,
  type RaiseState,
} from "@moneta/sdk";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { parseUnits, zeroAddress, type Address } from "viem";
import { Section } from "@/components/layout/Frame";
import { WalletButton } from "@/components/layout/Wallet";
import { Button } from "@/components/ui/button";
import {
  AddressChip,
  Countdown,
  KV,
  Memo,
  PageHeader,
  Panel,
  RaiseProgress,
} from "@/components/ui/display";
import { AmountInput } from "@/components/ui/forms";
import { StatusChip, Tag } from "@/components/ui/pills";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { QuoteFaucet } from "@/components/tx/QuoteFaucet";
import { indexer, quoteSym } from "@/lib/env";
import { useChainNow, useRaiseState } from "@/lib/hooks/chain";
import { INDEXER_POLL_MS } from "@/lib/hooks/indexed";
import { useMonetaTx } from "@/lib/hooks/tx";
import type { RaiseDetail } from "@/lib/server/data";
import { projectHref } from "@/lib/listing";

const INDEXED_STATUS = {
  OPEN: RaiseStatus.Open,
  FAILED: RaiseStatus.Failed,
  SUCCEEDED: RaiseStatus.Succeeded,
} as const;

/**
 * Display-only stand-in for the chain read, built from the indexer row the server rendered with. It fills
 * the first paint (and what crawlers and link previews see); the chain read replaces it on the client.
 * Fields the indexer doesn't carry are zero and their rows are hidden until `live`.
 */
function raiseFromIndex(m: RaiseDetail): RaiseState {
  return {
    address: m.address as Address,
    raiseId: BigInt(m.raiseId),
    quote: m.quote as Address,
    founder: m.founder_id as Address,
    price: BigInt(m.price),
    minRaise: BigInt(m.minRaise),
    maxRaise: BigInt(m.maxRaise),
    start: Number(m.start),
    end: Number(m.end),
    finalizeGrace: 0,
    liquidityBps: m.liquidityBps,
    feeBps: 0,
    status: INDEXED_STATUS[m.status],
    totalContributed: BigInt(m.totalContributed),
    contributorCount: BigInt(m.contributorCount),
    accepted: BigInt(m.accepted),
    contributorTokens: 0n,
    token: (m.token ?? zeroAddress) as Address,
    treasury: (m.treasury ?? zeroAddress) as Address,
  };
}

/** "Nov 12, 2026, 14:00 UTC": the same string on the server and in every browser (no hydration drift). */
const utcStamp = (s: number) =>
  `${new Date(s * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  })} UTC`;

export function RaiseView({ address, initial }: { address: Address; initial?: RaiseDetail }) {
  const tx = useMonetaTx();
  const chain = useRaiseState(address, tx.address);
  const indexed = useQuery({
    queryKey: ["idx", "raise", address],
    queryFn: () => indexer.raise(address),
    refetchInterval: INDEXER_POLL_MS,
    initialData: initial,
  });
  const founder = useQuery({
    queryKey: ["idx", "founder", indexed.data?.founder_id],
    enabled: !!indexed.data?.founder_id,
    queryFn: () => indexer.founderHistory(indexed.data!.founder_id),
  });
  const now = useChainNow();
  const meta = indexed.data ?? undefined;

  if (chain.isError && !meta)
    return (
      <ErrorState
        className="mt-12"
        title="Raise not found"
        body="This address isn't a Moneta raise on this network."
      />
    );
  const live = !!chain.data;
  const r = chain.data ?? (meta ? raiseFromIndex(meta) : undefined);
  if (!r) return <Skeleton className="mt-12 h-[480px] w-full rounded-[16px]" />;
  const ended = now !== undefined && now >= r.end;
  const graceOver = now !== undefined && now >= r.end + r.finalizeGrace;
  const statusChip =
    r.status === RaiseStatus.Open ? (
      ended ? (
        <StatusChip tone="warning" label="Awaiting finalize" />
      ) : (
        <StatusChip tone="accent" label="Raising" />
      )
    ) : r.status === RaiseStatus.Failed ? (
      <StatusChip tone="warning" label="Refunding" pulse={false} />
    ) : (
      <StatusChip tone="pass" label="Launched" pulse={false} />
    );

  return (
    <>
      <PageHeader
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            {statusChip}
            <Tag>${meta?.symbol ?? "…"}</Tag>
            <Tag>{quoteSym(r.quote)}</Tag>
          </div>
        }
        title={meta?.name ?? "Raise"}
        sub={
          <span className="inline-flex flex-wrap items-center gap-3">
            <AddressChip address={r.founder} label="Founder" />
            <AddressChip address={address} label="Raise" />
          </span>
        }
        actions={
          r.status === RaiseStatus.Succeeded ? (
            <Button asChild>
              <Link href={projectHref(r.treasury)}>Go to project →</Link>
            </Button>
          ) : undefined
        }
      />
      <Section dense className="pb-24">
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="flex flex-col gap-4 lg:col-span-3">
            <Panel title="Raise Memo">
              {meta ? (
                <Memo text={meta.memo} hash={meta.memoHash} />
              ) : (
                <Skeleton className="h-40 w-full" />
              )}
            </Panel>
            <Panel title="Terms">
              <KV
                rows={[
                  [
                    "Price",
                    `${formatTokenPrice(r.price)} per ${meta?.symbol ?? "token"} · same for everyone`,
                  ],
                  ["Minimum", `${formatUsd(r.minRaise)} — below this, 100% refunds`],
                  ["Maximum", `${formatUsd(r.maxRaise)} — above this, pro-rata refunds`],
                  [
                    "Window",
                    live
                      ? `${new Date(r.start * 1000).toLocaleString()} → ${new Date(r.end * 1000).toLocaleString()}`
                      : `${utcStamp(r.start)} → ${utcStamp(r.end)}`,
                  ],
                  [
                    "Liquidity seeded",
                    `${formatBps(r.liquidityBps)} of the net raise, at the raise price`,
                  ],
                  ...(live
                    ? ([["Protocol fee", formatBps(r.feeBps, { digits: 1 })]] as [string, string][])
                    : []),
                  ...(meta
                    ? ([
                        [
                          "Operating budget",
                          `${formatUsd(BigInt(meta.budgetPerMonth))} / month, streamed`,
                        ],
                        [
                          "Milestone tranches",
                          meta.trancheBps
                            .map((b, i) => `T${i + 1} ${formatBps(b, { digits: 0 })}`)
                            .join(" · ") || "None",
                        ],
                        [
                          "Thresholds (θ)",
                          `tranche ${formatBps(meta.thetaTrancheBps, { signed: true })} · team ${formatBps(meta.thetaTeamBps, { signed: true })} · community ${formatBps(meta.thetaCommunityBps, { signed: true })}`,
                        ],
                        [
                          "Decision window",
                          `${formatDuration(Number(meta.warmup))} warm-up · ${formatDuration(Number(meta.duration))} trading`,
                        ],
                        ["Proposal bond", formatUsd(BigInt(meta.bond))],
                      ] as [string, string][])
                    : []),
                ]}
              />
            </Panel>
            <Panel title="Backers">
              {founder.data && (
                <p className="mono-xs mb-4 text-fg-3">
                  Founder history: {founder.data.raiseCount} raise
                  {founder.data.raiseCount === 1 ? "" : "s"} · {founder.data.launchedCount} launched
                  · {founder.data.redeemedCount} redeemed
                </p>
              )}
              {!meta ? (
                <Skeleton className="h-24 w-full" />
              ) : meta.contributionEvents.length === 0 ? (
                <p className="body-sm text-fg-3">No contributions yet — be the first backer.</p>
              ) : (
                <ol className="divide-y divide-line-strong border-y border-line-strong">
                  {[...meta.contributionEvents]
                    .reverse()
                    .slice(0, 25)
                    .map((e) => (
                      <li
                        key={e.txHash + e.account}
                        className="flex items-center justify-between gap-4 py-2.5 body-sm"
                      >
                        <span className="mono-xs text-fg-2">{shortAddress(e.account)}</span>
                        <span className="tabular">+{formatUsd(BigInt(e.amount))}</span>
                        <span className="mono-xs hidden text-fg-3 sm:inline">
                          {live
                            ? new Date(Number(e.timestamp) * 1000).toLocaleTimeString()
                            : utcStamp(Number(e.timestamp))}
                        </span>
                      </li>
                    ))}
                </ol>
              )}
            </Panel>
          </div>
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <Panel>
              <div className="flex flex-col gap-6">
                <RaiseProgress total={r.totalContributed} min={r.minRaise} max={r.maxRaise} />
                <div className="flex items-end justify-between gap-3">
                  {r.status === RaiseStatus.Open && (
                    <Countdown to={r.end} label="until the window closes" />
                  )}
                  <div className="text-right">
                    <p className="figure-lg">{r.contributorCount.toString()}</p>
                    <p className="mono-xs mt-1 text-fg-3">backers</p>
                  </div>
                </div>
                {live ? (
                  <RaiseActions
                    address={address}
                    ended={ended}
                    graceOver={graceOver}
                    symbol={meta?.symbol ?? "tokens"}
                  />
                ) : (
                  <Skeleton className="h-28 w-full" />
                )}
              </div>
            </Panel>
          </aside>
        </div>
      </Section>
    </>
  );
}

function RaiseActions({
  address,
  ended,
  graceOver,
  symbol,
}: {
  address: Address;
  ended: boolean;
  graceOver: boolean;
  symbol: string;
}) {
  const tx = useMonetaTx();
  const chain = useRaiseState(address, tx.address);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const r = chain.data;
  if (!r) return null;
  const acct = r.account;
  const qSym = quoteSym(r.quote);

  if (!tx.isConnected) {
    return (
      <div className="flex flex-col gap-3">
        <p className="body-sm text-fg-2">Connect a wallet to back this raise.</p>
        <WalletButton block />
      </div>
    );
  }

  if (r.status === RaiseStatus.Open && !ended) {
    let parsed = 0n;
    try {
      parsed = amount ? parseUnits(amount, 6) : 0n;
    } catch {
      parsed = 0n;
    }
    const insufficient = acct !== undefined && parsed > acct.quoteBalance;
    const contribute = async () => {
      if (!(await tx.ensureReady())) return;
      setBusy(true);
      try {
        const permit = await tx.permit(r.quote, address, parsed).catch(() => undefined);
        if (permit === undefined) return; // user rejected the signature
        const request = permit
          ? txs.contributeWithPermit(address, parsed, permit)
          : txs.contribute(address, parsed);
        if (!permit && !(await tx.ensureAllowance(r.quote, address, parsed, qSym))) return;
        const ok = await tx.run({ title: `Contribute ${formatUsd(parsed)}`, request });
        if (ok) setAmount("");
      } finally {
        setBusy(false);
      }
    };
    return (
      <div className="flex flex-col gap-4">
        <AmountInput
          label={`Contribution in ${qSym}`}
          value={amount}
          onChange={setAmount}
          symbol={qSym}
          invalid={insufficient}
          balanceLabel={acct ? `Balance ${formatUsd(acct.quoteBalance)}` : undefined}
          onMax={acct ? () => setAmount((Number(acct.quoteBalance) / 1e6).toString()) : undefined}
        />
        {parsed > 0n && (
          <p className="mono-xs text-fg-3">
            ≈ {formatToken(tokensForQuote(parsed, r.price), 18, symbol)} at{" "}
            {formatTokenPrice(r.price)} — fewer if oversubscribed (excess refunded).
          </p>
        )}
        {acct && acct.contribution > 0n && (
          <p className="mono-xs text-fg-2">Your contribution: {formatUsd(acct.contribution)}</p>
        )}
        <Button
          variant="accent"
          size="lg"
          disabled={parsed === 0n || insufficient}
          loading={busy}
          onClick={contribute}
        >
          {insufficient ? `Insufficient ${qSym}` : "Contribute"}
        </Button>
        <QuoteFaucet quote={r.quote} balance={acct?.quoteBalance} />
      </div>
    );
  }

  if (r.status === RaiseStatus.Open && ended) {
    return (
      <div className="flex flex-col gap-3">
        <p className="body-sm text-fg-2">
          The window has closed. Anyone can finalize:{" "}
          {r.totalContributed >= r.minRaise
            ? "the project launches atomically."
            : "the minimum wasn't met — everyone is refunded."}
        </p>
        <Button
          variant="accent"
          onClick={() => tx.run({ title: "Finalize raise", request: txs.finalizeRaise(address) })}
        >
          Finalize raise
        </Button>
        {graceOver && (
          <Button
            variant="tertiary"
            onClick={() =>
              tx.run({ title: "Abort raise (refund all)", request: txs.abortRaise(address) })
            }
          >
            Abort & refund all
          </Button>
        )}
      </div>
    );
  }

  // finalized: claims
  if (!acct || acct.contribution === 0n) {
    return (
      <EmptyState
        motif="coins"
        title="Nothing to claim"
        body="This wallet didn't contribute to this raise."
        className="border-0 bg-transparent px-0 py-2"
      />
    );
  }
  if (acct.claimed)
    return (
      <p className="body-sm text-fg-2">
        ✓ Claimed.{" "}
        {r.status === RaiseStatus.Succeeded
          ? "Your tokens are in your wallet."
          : `Your ${qSym} was refunded.`}
      </p>
    );
  return (
    <div className="flex flex-col gap-3">
      <KV
        rows={[
          ...(acct.claimableTokens > 0n
            ? ([["Tokens", formatToken(acct.claimableTokens, 18, symbol)]] as [string, string][])
            : []),
          ["Refund", formatUsd(acct.claimableRefund)],
        ]}
      />
      <Button
        variant="accent"
        onClick={() =>
          tx.run({
            title: r.status === RaiseStatus.Succeeded ? "Claim tokens" : "Claim refund",
            request: txs.claim(address),
          })
        }
      >
        {r.status === RaiseStatus.Succeeded ? "Claim" : "Claim refund"}
      </Button>
    </div>
  );
}
