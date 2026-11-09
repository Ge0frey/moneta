"use client";

import {
  actionTitle,
  big,
  decodeAction,
  FAUCETS,
  formatScaledPrice,
  formatToken,
  formatUsd,
  isQuoteAsset,
  PRICE_SCALE,
  quoteAssets,
  readProject,
  readRaise,
  RaiseStatus,
  txs,
  type IndexedPosition,
} from "@moneta/sdk";
import { useQueries, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import type { Address, PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { Section } from "@/components/layout/Frame";
import { WalletButton } from "@/components/layout/Wallet";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/cards";
import { PageHeader } from "@/components/ui/display";
import { Chip, Eyebrow, StatusChip } from "@/components/ui/pills";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { MintTestQuote } from "@/components/tx/QuoteFaucet";
import { deployment, indexer, IS_TESTNET, requireDeployment } from "@/lib/env";
import { useBalances } from "@/lib/hooks/chain";
import { INDEXER_POLL_MS } from "@/lib/hooks/indexed";
import { useMounted } from "@/lib/hooks/mounted";
import { useMonetaTx } from "@/lib/hooks/tx";

const TABS = [
  { id: "contributions", label: "Contributions" },
  { id: "positions", label: "Positions" },
  { id: "tokens", label: "Tokens" },
  { id: "redemptions", label: "Redemptions" },
] as const;
type Tab = (typeof TABS)[number]["id"];

/**
 * Portfolio: the indexer lists what you're involved in; every amount you can act on is re-read from
 * the chain (previewClaim, balanceOf, redemption snapshot) before a button is enabled.
 */
export function PortfolioView() {
  const tx = useMonetaTx();
  const mounted = useMounted();
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const tab = (
    TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "contributions"
  ) as Tab;
  const account = tx.address?.toLowerCase();
  const data = useQuery({
    queryKey: ["idx", "portfolio", account],
    enabled: !!account,
    queryFn: () => indexer.portfolio(account!),
    refetchInterval: INDEXER_POLL_MS,
  });

  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params);
    if (t === "contributions") next.delete("tab");
    else next.set("tab", t);
    router.replace(`${path}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const header = (
    <PageHeader
      eyebrow={<Eyebrow className="w-fit">Portfolio</Eyebrow>}
      title="Your Moneta."
      sub="Raises you backed, market positions to redeem, and the treasuries you own a share of."
    />
  );

  if (!mounted)
    return (
      <>
        {header}
        <Skeleton className="mb-24 h-[320px] w-full rounded-[16px]" />
      </>
    );
  if (!tx.isConnected) {
    return (
      <>
        {header}
        <EmptyState
          className="mb-24"
          motif="coins"
          title="Connect a wallet"
          body="Your contributions, positions and tokens are read from the chain for the connected address."
          action={<WalletButton />}
        />
      </>
    );
  }

  const contributions = data.data?.Contribution ?? [];
  const positions = data.data?.Position ?? [];
  const holdings = (data.data?.Holder ?? []).filter((h) => h.project.state !== "REDEEMED");
  const redeemable = (data.data?.Holder ?? []).filter((h) => h.project.state === "REDEEMED");
  const conditions = [...new Set(positions.map((p) => p.conditionId))];
  const tokenValue = holdings.reduce(
    (a, h) => a + (big(h.balance) * big(h.project.lastPrice)) / PRICE_SCALE,
    0n,
  );
  const counts: Record<Tab, number> = {
    contributions: contributions.length,
    positions: conditions.length,
    tokens: holdings.length,
    redemptions: redeemable.length,
  };

  return (
    <>
      {header}
      <div className="grid gap-4 pb-8 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Contributed"
          value={
            data.data ? (
              formatUsd(
                contributions.reduce((a, c) => a + big(c.amount), 0n),
                6,
                { compact: true },
              )
            ) : (
              <Skeleton className="h-10 w-32" />
            )
          }
          sub={`${contributions.length} raise${contributions.length === 1 ? "" : "s"}`}
        />
        <StatTile
          label="Token Value"
          value={
            data.data ? (
              formatUsd(tokenValue, 6, { compact: true })
            ) : (
              <Skeleton className="h-10 w-32" />
            )
          }
          sub={`${holdings.length} project${holdings.length === 1 ? "" : "s"} at last spot`}
        />
        <StatTile
          label="Open Markets"
          value={data.data ? conditions.length : <Skeleton className="h-10 w-16" />}
          sub="proposals with positions"
        />
        <StatTile
          label="Redeemable"
          value={data.data ? redeemable.length : <Skeleton className="h-10 w-16" />}
          sub="wound-down treasuries"
        />
      </div>
      {(IS_TESTNET || deployment?.testQuote) && <TestFunds account={tx.address!} />}
      <div className="-ml-1 flex flex-wrap gap-2 pb-6" role="group" aria-label="Portfolio sections">
        {TABS.map((t) => (
          <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
            {data.data && <span className="ml-2 opacity-60">{counts[t.id]}</span>}
          </Chip>
        ))}
      </div>
      <Section dense className="pb-24">
        {data.isError ? (
          <ErrorState
            title="Couldn't load your portfolio"
            body="The indexer didn't respond. Chain balances are unaffected."
            onRetry={() => data.refetch()}
          />
        ) : !data.data ? (
          <Skeleton className="h-64 w-full rounded-[16px]" />
        ) : tab === "contributions" ? (
          <Contributions rows={contributions} account={tx.address!} />
        ) : tab === "positions" ? (
          <Positions positions={positions} conditions={conditions} account={tx.address!} />
        ) : tab === "tokens" ? (
          <Tokens rows={holdings} account={tx.address!} />
        ) : (
          <Redemptions rows={redeemable} account={tx.address!} />
        )}
      </Section>
    </>
  );
}

/** Test funds: Circle USDC from its faucet (testnet), the test quote (mUSDC) minted in one click. */
function TestFunds({ account }: { account: Address }) {
  const quotes = quoteAssets(requireDeployment());
  const bal = useBalances(
    account,
    quotes.map((q) => q.address),
  );
  return (
    <section
      id="test-funds"
      aria-label="Test funds"
      className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-[16px] border border-line-subtle bg-surface-1 px-6 py-4"
    >
      <p className="mono-xs text-fg-3 uppercase">Test funds</p>
      {quotes.map((q) => (
        <div key={q.address} className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="body-sm tabular">
            {bal.data ? formatToken(bal.data[q.address] ?? 0n, 6, q.symbol) : `… ${q.symbol}`}
          </span>
          {q.test ? (
            <MintTestQuote quote={q.address} />
          ) : IS_TESTNET ? (
            <a
              href={FAUCETS.usdc}
              target="_blank"
              rel="noreferrer"
              className="mono-xs text-accent hover:text-accent-hover"
            >
              Circle faucet ↗
            </a>
          ) : null}
        </div>
      ))}
    </section>
  );
}

function Table({
  head,
  children,
  caption,
}: {
  head: ReactNode[];
  children: ReactNode;
  caption: string;
}) {
  return (
    <div className="overflow-x-auto rounded-[16px] border border-line-subtle bg-surface-1 px-6 py-2">
      <table className="w-full min-w-[640px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="mono-xs text-fg-3 uppercase">
            {head.map((h, i) => (
              <th key={i} className={`py-3 font-normal ${i === 0 ? "text-left" : "text-right"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

type Contribution = NonNullable<
  Awaited<ReturnType<typeof indexer.portfolio>>
>["Contribution"][number];

function Contributions({ rows, account }: { rows: Contribution[]; account: Address }) {
  const client = usePublicClient() as PublicClient | undefined;
  const tx = useMonetaTx();
  const chain = useQueries({
    queries: rows.map((r) => ({
      queryKey: ["chain", "raise", r.raise_id, account],
      enabled: !!client,
      refetchInterval: 6_000,
      queryFn: () => readRaise(client!, r.raise_id as Address, account),
    })),
  });
  if (!rows.length) {
    return (
      <EmptyState
        title="No contributions yet"
        body="Back a raise and your allocation, refunds and claims show up here."
        action={
          <Button asChild variant="tertiary">
            <Link href="/explore?status=raising">Find a raise</Link>
          </Button>
        }
      />
    );
  }
  return (
    <Table caption="Your contributions" head={["Raise", "Contributed", "Status", "Claimable", ""]}>
      {rows.map((r, i) => {
        const c = chain[i]?.data;
        const a = c?.account;
        const claimable = !!a && !a.claimed && (a.claimableTokens > 0n || a.claimableRefund > 0n);
        const status = !c ? (
          <Skeleton className="h-5 w-20" />
        ) : c.status === RaiseStatus.Open ? (
          <StatusChip tone="accent" label="Raising" />
        ) : c.status === RaiseStatus.Failed ? (
          <StatusChip tone="warning" label="Refunding" pulse={false} />
        ) : (
          <StatusChip tone="pass" label="Launched" pulse={false} />
        );
        return (
          <tr key={r.raise_id} className="border-t border-line-strong">
            <td className="py-3 pr-3">
              <Link href={`/raise/${r.raise_id}`} className="body-sm text-fg hover:underline">
                {r.raise.name}
              </Link>
              <p className="mono-xs text-fg-3">${r.raise.symbol}</p>
            </td>
            <td className="py-3 text-right body-sm tabular">
              {formatUsd(a?.contribution ?? big(r.amount))}
            </td>
            <td className="py-3 text-right">{status}</td>
            <td className="py-3 text-right body-sm tabular">
              {!a ? (
                "…"
              ) : a.claimed ? (
                <span className="text-fg-3">Claimed</span>
              ) : c!.status === RaiseStatus.Open ? (
                <span className="text-fg-3">After finalize</span>
              ) : (
                <>
                  {a.claimableTokens > 0n && (
                    <span className="block">
                      {formatToken(a.claimableTokens, 18, r.raise.symbol)}
                    </span>
                  )}
                  {a.claimableRefund > 0n && (
                    <span className="block text-fg-2">+ {formatUsd(a.claimableRefund)} refund</span>
                  )}
                </>
              )}
            </td>
            <td className="py-3 pl-3 text-right">
              {claimable ? (
                <Button
                  size="sm"
                  variant="accent"
                  onClick={() =>
                    tx.run({
                      title: `Claim from ${r.raise.symbol} raise`,
                      request: txs.claim(r.raise_id as Address),
                    })
                  }
                >
                  Claim
                </Button>
              ) : r.raise.treasury ? (
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/project/${r.raise.treasury}`}>Project →</Link>
                </Button>
              ) : null}
            </td>
          </tr>
        );
      })}
    </Table>
  );
}

function Positions({
  positions,
  conditions,
  account,
}: {
  positions: IndexedPosition[];
  conditions: string[];
  account: Address;
}) {
  const tx = useMonetaTx();
  const d = requireDeployment();
  const proposals = useQuery({
    queryKey: ["idx", "proposalsByCondition", ...conditions],
    queryFn: () => indexer.proposalsByCondition(conditions),
  });
  const balances = useBalances(
    account,
    positions.map((p) => p.token as Address),
  );
  if (!conditions.length) {
    return (
      <EmptyState
        motif="fork"
        title="No market positions"
        body="Trade PASS or FAIL on a live proposal. Winning positions to redeem show up here after the verdict."
        action={
          <Button asChild variant="tertiary">
            <Link href="/explore?status=verdict">Find a live verdict</Link>
          </Button>
        }
      />
    );
  }
  if (!proposals.data) return <Skeleton className="h-48 w-full rounded-[16px]" />;
  return (
    <Table
      caption="Your decision-market positions"
      head={["Proposal", "PASS side", "FAIL side", "Status", ""]}
    >
      {proposals.data.map((pr) => {
        const mine = positions.filter((p) => p.conditionId === pr.conditionId);
        const amt = (side: "PASS" | "FAIL") =>
          mine
            .filter((p) => p.side === side)
            .map((p) => {
              const bal = balances.data?.[p.token as Address] ?? big(p.balance);
              const isQuote = isQuoteAsset(d, p.collateral);
              return bal > 0n ? (
                <span key={p.token} className="block">
                  {isQuote ? formatUsd(bal) : formatToken(bal, 18, pr.project.symbol)}
                </span>
              ) : null;
            });
        const resolved = ["PASSED", "FAILED", "EXECUTED"].includes(pr.status);
        const live = pr.status === "ACTIVE";
        let title = `Proposal #${pr.proposalId}`;
        try {
          title = actionTitle(decodeAction(pr.actionType, pr.actionData));
        } catch {}
        return (
          <tr key={pr.id} className="border-t border-line-strong">
            <td className="py-3 pr-3">
              <Link
                href={`/project/${pr.project.treasury}/proposal/${pr.proposalId}`}
                className="body-sm text-fg hover:underline"
              >
                {title}
              </Link>
              <p className="mono-xs text-fg-3">
                {pr.project.name} · #{pr.proposalId}
              </p>
            </td>
            <td className="py-3 text-right body-sm tabular text-pass">{amt("PASS")}</td>
            <td className="py-3 text-right body-sm tabular text-fail">{amt("FAIL")}</td>
            <td className="py-3 text-right">
              {live ? (
                <StatusChip tone="live" label="Live" />
              ) : pr.passed ? (
                <StatusChip tone="pass" label="Passed" pulse={false} />
              ) : resolved ? (
                <StatusChip tone="fail" label="Failed" pulse={false} />
              ) : (
                <StatusChip tone="muted" label={pr.status.toLowerCase()} pulse={false} />
              )}
            </td>
            <td className="py-3 pl-3 text-right">
              {resolved ? (
                <Button
                  size="sm"
                  variant="accent"
                  onClick={() =>
                    tx.run({
                      title: "Redeem winning positions",
                      request: txs.redeemAll(d, pr.project.treasury as Address, big(pr.proposalId)),
                    })
                  }
                >
                  Redeem
                </Button>
              ) : (
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/project/${pr.project.treasury}/proposal/${pr.proposalId}`}>
                    Trade →
                  </Link>
                </Button>
              )}
            </td>
          </tr>
        );
      })}
    </Table>
  );
}

type Holding = NonNullable<Awaited<ReturnType<typeof indexer.portfolio>>>["Holder"][number];

function Tokens({ rows, account }: { rows: Holding[]; account: Address }) {
  const balances = useBalances(
    account,
    rows.map((h) => h.project.token as Address),
  );
  if (!rows.length) {
    return (
      <EmptyState
        title="No project tokens"
        body="Claim tokens from a launched raise or buy on a project's spot market."
        action={
          <Button asChild variant="tertiary">
            <Link href="/explore?status=governing">Browse treasuries</Link>
          </Button>
        }
      />
    );
  }
  return (
    <Table caption="Your project tokens" head={["Project", "Balance", "Spot", "Value", ""]}>
      {rows.map((h) => {
        const bal = balances.data?.[h.project.token as Address] ?? big(h.balance);
        const price = big(h.project.lastPrice);
        return (
          <tr key={h.project.token} className="border-t border-line-strong">
            <td className="py-3 pr-3">
              <Link
                href={`/project/${h.project.treasury}`}
                className="body-sm text-fg hover:underline"
              >
                {h.project.name}
              </Link>
              <p className="mono-xs text-fg-3">${h.project.symbol}</p>
            </td>
            <td className="py-3 text-right body-sm tabular">{formatToken(bal, 18)}</td>
            <td className="py-3 text-right body-sm tabular">
              {price > 0n ? formatScaledPrice(price) : "—"}
            </td>
            <td className="py-3 text-right body-sm tabular">
              {formatUsd((bal * price) / PRICE_SCALE)}
            </td>
            <td className="py-3 pl-3 text-right">
              <Button asChild size="sm" variant="ghost">
                <Link href={`/project/${h.project.treasury}`}>Trade →</Link>
              </Button>
            </td>
          </tr>
        );
      })}
    </Table>
  );
}

function Redemptions({ rows, account }: { rows: Holding[]; account: Address }) {
  const client = usePublicClient() as PublicClient | undefined;
  const tx = useMonetaTx();
  const balances = useBalances(
    account,
    rows.map((h) => h.project.token as Address),
  );
  const projects = useQueries({
    queries: rows.map((h) => ({
      queryKey: ["chain", "project", h.project.treasury],
      enabled: !!client,
      queryFn: () => readProject(client!, requireDeployment(), h.project.treasury as Address),
    })),
  });
  if (!rows.length) {
    return (
      <EmptyState
        motif="fork"
        title="Nothing to redeem"
        body="If holders vote to wind a project down, your exit at NAV shows up here."
      />
    );
  }
  return (
    <Table caption="Treasuries you can redeem from" head={["Project", "Balance", "Payout", ""]}>
      {rows.map((h, i) => {
        const p = projects[i]?.data;
        const bal = balances.data?.[h.project.token as Address] ?? big(h.balance);
        const payout =
          p && p.redemptionSupply > 0n ? (bal * p.redemptionQuote) / p.redemptionSupply : undefined;
        return (
          <tr key={h.project.token} className="border-t border-line-strong">
            <td className="py-3 pr-3">
              <Link
                href={`/project/${h.project.treasury}`}
                className="body-sm text-fg hover:underline"
              >
                {h.project.name}
              </Link>
              <p className="mono-xs text-fg-3">${h.project.symbol} · redeemed</p>
            </td>
            <td className="py-3 text-right body-sm tabular">{formatToken(bal, 18)}</td>
            <td className="py-3 text-right body-sm tabular">
              {payout === undefined ? "…" : formatUsd(payout)}
            </td>
            <td className="py-3 pl-3 text-right">
              <Button
                size="sm"
                variant="accent"
                disabled={!payout || bal === 0n}
                onClick={() =>
                  tx.run({
                    title: `Redeem ${formatToken(bal, 18, h.project.symbol)}`,
                    request: txs.redeem(h.project.treasury as Address, bal),
                  })
                }
              >
                Redeem all
              </Button>
            </td>
          </tr>
        );
      })}
    </Table>
  );
}
