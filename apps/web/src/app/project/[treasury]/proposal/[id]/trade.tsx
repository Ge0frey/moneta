"use client";

import {
  big,
  formatBps,
  formatToken,
  formatUsd,
  Outcome,
  ProposalStatus,
  quoteSwap,
  readPool,
  shortAddress,
  txs,
  withSlippage,
  type IndexedProposal,
  type IndexedTrade,
  type ProjectView,
  type ProposalView,
} from "@moneta/sdk";
import { useState } from "react";
import { WalletButton } from "@/components/layout/Wallet";
import { SlippageControl, useSlippage } from "@/components/market/Slippage";
import { parseUnits, type PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { Button } from "@/components/ui/button";
import { KV, Panel } from "@/components/ui/display";
import { AmountInput, Segmented } from "@/components/ui/forms";
import { requireDeployment } from "@/lib/env";
import { useBalances } from "@/lib/hooks/chain";
import { useMonetaTx } from "@/lib/hooks/tx";

function parse(v: string, decimals: number) {
  try {
    return v ? parseUnits(v, decimals) : 0n;
  } catch {
    return 0n;
  }
}

/** Trade a decision market. Buying one world never risks the stake in the other. */
export function TradePanel({ project, view }: { project: ProjectView; view: ProposalView }) {
  const tx = useMonetaTx();
  const d = requireDeployment();
  const [side, setSide] = useState<"pass" | "fail">("pass");
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const slippage = useSlippage((x) => x.bps);
  const client = usePublicClient() as PublicClient | undefined;
  const t = view.tokens!;
  const bal = useBalances(tx.address, [
    project.quote,
    t.passToken,
    t.failToken,
    t.passQuote,
    t.failQuote,
  ]);
  const pass = side === "pass";
  const sym = project.tokenMeta.symbol;
  const pool = pass ? view.passPool! : view.failPool!;
  const buy = mode === "buy";
  const decimals = buy ? 6 : 18;
  const parsed = parse(amount, decimals);
  const sideToken = pass ? t.passToken : t.failToken;
  const otherQuote = pass ? t.failQuote : t.passQuote;
  const balance = (buy ? bal.data?.[project.quote] : bal.data?.[sideToken]) ?? 0n;
  const q = quoteSwap(
    { reserveBase: pool.reserveBase, reserveQuote: pool.reserveQuote, feeBps: pool.feeBps },
    !buy,
    parsed,
  );
  const insufficient = parsed > balance;
  const world = pass ? "PASS" : "FAIL";
  const other = pass ? "FAIL" : "PASS";
  const settles = buy
    ? 0n
    : q.amountOut < (bal.data?.[otherQuote] ?? 0n)
      ? q.amountOut
      : (bal.data?.[otherQuote] ?? 0n);

  const submit = async () => {
    if (!(await tx.ensureReady())) return;
    setBusy(true);
    try {
      // Re-quote against the latest block: on 300ms Monad blocks a 2s-old view is already several trades stale.
      const fresh = client
        ? await readPool(client, d.amm, pass ? view.proposal.passPoolId : view.proposal.failPoolId)
        : pool;
      const minOut = withSlippage(
        quoteSwap(
          {
            reserveBase: fresh.reserveBase,
            reserveQuote: fresh.reserveQuote,
            feeBps: fresh.feeBps,
          },
          !buy,
          parsed,
        ).amountOut,
        slippage,
      );
      let ok;
      if (buy) {
        const permit = await tx.permit(project.quote, d.router, parsed).catch(() => undefined);
        if (permit === undefined) return;
        if (!permit && !(await tx.ensureAllowance(project.quote, d.router, parsed, "USDC"))) return;
        ok = await tx.run({
          title: `Buy ${world} with ${formatUsd(parsed)}`,
          request: txs.buyOutcome(
            d,
            project.treasury,
            view.id,
            pass,
            parsed,
            minOut,
            permit ?? undefined,
          ),
        });
      } else {
        ok = await tx.run({
          title: `Sell ${formatToken(parsed, 18)} ${world} ${sym}`,
          request: txs.sellOutcome(d, project.treasury, view.id, pass, parsed, minOut),
        });
      }
      if (ok) setAmount("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Trade the verdict">
      <div className="flex flex-col gap-4">
        <Segmented
          label="World"
          value={side}
          onChange={(v) => {
            setSide(v);
            setAmount("");
          }}
          options={[
            { value: "pass", label: "▲ PASS", tone: "pass" },
            { value: "fail", label: "▼ FAIL", tone: "fail" },
          ]}
        />
        <Segmented
          label="Direction"
          value={mode}
          onChange={(v) => {
            setMode(v);
            setAmount("");
          }}
          options={[
            { value: "buy", label: "Buy" },
            { value: "sell", label: "Sell" },
          ]}
        />
        <AmountInput
          label={buy ? "USDC to spend" : `${world} ${sym} to sell`}
          value={amount}
          onChange={setAmount}
          symbol={buy ? "USDC" : `${pass ? "p" : "f"}${sym}`}
          invalid={insufficient}
          balanceLabel={
            tx.isConnected
              ? `Balance ${buy ? formatUsd(balance) : formatToken(balance, 18)}`
              : undefined
          }
          onMax={
            tx.isConnected
              ? () => setAmount((Number(balance) / 10 ** decimals).toString())
              : undefined
          }
        />
        {parsed > 0n && (
          <>
            <KV
              rows={[
                [
                  buy ? `${world} ${sym} received` : `${world} USDC received`,
                  buy ? formatToken(q.amountOut, 18) : formatUsd(q.amountOut),
                ],
                ["Price impact", formatBps(q.priceImpactBps)],
              ]}
            />
            <SlippageControl />
            <div className="rounded-[8px] border border-line bg-surface-2 p-3 mono-xs leading-5 text-fg-2">
              {buy ? (
                <>
                  <p>
                    <span className={pass ? "text-pass" : "text-fail"}>If {world}:</span> you hold{" "}
                    {formatToken(q.amountOut, 18)} {world}-{sym}, redeemable 1:1 for {sym}.
                  </p>
                  <p>
                    If {other}: your {formatUsd(parsed)} comes back ({other}-USDC redeems 1:1).
                  </p>
                </>
              ) : (
                <p>
                  {formatUsd(settles)} settles to real USDC by merging with your {other}-USDC
                  {q.amountOut > settles
                    ? `; ${formatUsd(q.amountOut - settles)} stays as ${world}-USDC`
                    : ""}
                  .
                </p>
              )}
            </div>
          </>
        )}
        <Button
          variant={pass ? "pass" : "fail"}
          size="lg"
          disabled={parsed === 0n || insufficient || q.amountOut === 0n}
          loading={busy}
          onClick={submit}
        >
          {insufficient
            ? "Insufficient balance"
            : `${buy ? "Buy" : "Sell"} ${pass ? "PASS ▲" : "FAIL ▼"}`}
        </Button>
      </div>
    </Panel>
  );
}

/** Your conditional positions: merge pairs before the verdict, redeem the winning side after. */
export function PositionsPanel({ project, view }: { project: ProjectView; view: ProposalView }) {
  const tx = useMonetaTx();
  const d = requireDeployment();
  const t = view.tokens;
  const bal = useBalances(
    tx.address,
    t ? [t.passToken, t.failToken, t.passQuote, t.failQuote] : [],
  );
  if (!t || !tx.isConnected) return null;
  const sym = project.tokenMeta.symbol;
  const b = (a: string) => bal.data?.[a as `0x${string}`] ?? 0n;
  const rows: [string, string][] = [
    [`▲ PASS-${sym}`, formatToken(b(t.passToken), 18)],
    [`▼ FAIL-${sym}`, formatToken(b(t.failToken), 18)],
    ["▲ PASS-USDC", formatUsd(b(t.passQuote))],
    ["▼ FAIL-USDC", formatUsd(b(t.failQuote))],
  ];
  const any = b(t.passToken) + b(t.failToken) + b(t.passQuote) + b(t.failQuote) > 0n;
  const resolved = view.outcome !== Outcome.Unresolved;
  const mergeable =
    (b(t.passToken) > 0n && b(t.failToken) > 0n) || (b(t.passQuote) > 0n && b(t.failQuote) > 0n);
  return (
    <Panel title="Your positions">
      {!any ? (
        <p className="body-sm text-fg-3">No positions in this market.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <KV rows={rows} />
          {resolved ? (
            <Button
              variant="accent"
              onClick={() =>
                tx.run({
                  title: "Redeem winning positions",
                  request: txs.redeemAll(d, project.treasury, view.id),
                })
              }
            >
              Redeem {view.outcome === Outcome.Pass ? "▲ PASS" : "▼ FAIL"} side
            </Button>
          ) : (
            mergeable && (
              <Button
                variant="tertiary"
                onClick={() =>
                  tx.run({
                    title: "Merge matched pairs",
                    request: txs.mergeAll(d, project.treasury, view.id),
                  })
                }
              >
                Merge matched pairs
              </Button>
            )
          )}
        </div>
      )}
    </Panel>
  );
}

/** Market facts for any phase; also the connect prompt when no wallet is attached. */
export function MarketPanel({
  project,
  view,
  indexed,
  awaitingFinalize,
}: {
  project: ProjectView;
  view: ProposalView;
  indexed?: IndexedProposal;
  awaitingFinalize: boolean;
}) {
  const tx = useMonetaTx();
  const pr = view.proposal;
  const sym = project.tokenMeta.symbol;
  const settled = pr.status >= ProposalStatus.Passed;
  const bond =
    pr.bond === 0n
      ? "None"
      : !settled
        ? `${formatUsd(pr.bond)} at stake`
        : pr.status === ProposalStatus.Failed
          ? `${formatUsd(pr.bond)} kept by treasury`
          : `${formatUsd(pr.bond)} refunded`;
  return (
    <Panel title="Market">
      <div className="flex flex-col gap-4">
        {awaitingFinalize && (
          <p className="body-sm text-fg-2">
            Trading has closed. Anyone can finalize the verdict now; the keeper usually does within
            seconds.
          </p>
        )}
        <KV
          rows={[
            ["Volume", indexed ? formatUsd(big(indexed.volumeQuote)) : "…"],
            ["Trades", indexed ? indexed.tradeCount.toLocaleString() : "…"],
            [
              "Liquidity per side",
              `${formatUsd(pr.migratedQuote)} + ${formatToken(pr.migratedBase, 18)} ${sym}`,
            ],
            ["Bond", bond],
          ]}
        />
        {!tx.isConnected && (
          <div className="flex flex-col gap-3 border-t border-line-strong pt-4">
            <p className="body-sm text-fg-2">
              Connect a wallet to trade this verdict or redeem your positions.
            </p>
            <WalletButton block />
          </div>
        )}
      </div>
    </Panel>
  );
}

const TRADES_PREVIEW = 12;

export function TradesPanel({ trades }: { trades?: IndexedTrade[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? trades : trades?.slice(0, TRADES_PREVIEW);
  return (
    <Panel
      title="Trades"
      action={
        trades && trades.length > TRADES_PREVIEW ? (
          <Button variant="ghost" size="sm" onClick={() => setAll((x) => !x)} aria-expanded={all}>
            {all ? "Show fewer" : `Show all ${trades.length}`}
          </Button>
        ) : undefined
      }
    >
      {!shown?.length ? (
        <p className="body-sm text-fg-3">No trades yet.</p>
      ) : (
        <ol className="divide-y divide-line-strong border-y border-line-strong">
          {shown.map((t) => (
            <li
              key={t.id}
              className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 py-2.5 body-sm"
            >
              <span className={`mono-xs ${t.side === "PASS" ? "text-pass" : "text-fail"}`}>
                {t.side === "PASS" ? "▲" : "▼"} {t.isBuy ? "Buy" : "Sell"} {t.side}
              </span>
              <span className="mono-xs text-fg-3">{shortAddress(t.trader)}</span>
              <span className="mono-xs hidden text-fg-3 sm:inline">
                {new Date(Number(t.timestamp) * 1000).toLocaleTimeString()}
              </span>
              <span className="tabular text-right">
                {t.isBuy ? formatUsd(big(t.amountIn)) : formatUsd(big(t.amountOut))}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
