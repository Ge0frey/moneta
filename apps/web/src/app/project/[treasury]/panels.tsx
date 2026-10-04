"use client";

import {
  formatBps,
  formatCountdown,
  formatToken,
  formatTokenPrice,
  formatUsd,
  quoteSwap,
  readPool,
  txs,
  withSlippage,
  type ProjectView,
} from "@moneta/sdk";
import { useState } from "react";
import { parseUnits, type PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { SlippageControl, useSlippage } from "@/components/market/Slippage";
import { Button } from "@/components/ui/button";
import { KV, Panel } from "@/components/ui/display";
import { AmountInput, Segmented } from "@/components/ui/forms";
import { requireDeployment } from "@/lib/env";
import { useBalances, useChainNow } from "@/lib/hooks/chain";
import { useMonetaTx } from "@/lib/hooks/tx";

function parse(v: string, decimals: number) {
  try {
    return v ? parseUnits(v, decimals) : 0n;
  } catch {
    return 0n;
  }
}

/** Spot swap on the treasury-owned pool. */
export function SwapPanel({ project }: { project: ProjectView }) {
  const tx = useMonetaTx();
  const d = requireDeployment();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const slippage = useSlippage((x) => x.bps);
  const client = usePublicClient() as PublicClient | undefined;
  const bal = useBalances(tx.address, [project.quote, project.token]);
  const sym = project.tokenMeta.symbol;
  const buy = side === "buy";
  const inDecimals = buy ? 6 : 18;
  const parsed = parse(amount, inDecimals);
  const balance = bal.data?.[buy ? project.quote : project.token] ?? 0n;
  const q = quoteSwap(
    {
      reserveBase: project.spot.reserveBase,
      reserveQuote: project.spot.reserveQuote,
      feeBps: project.spot.feeBps,
    },
    !buy,
    parsed,
  );
  const insufficient = parsed > balance;

  const submit = async () => {
    if (!(await tx.ensureReady())) return;
    setBusy(true);
    try {
      const tokenIn = buy ? project.quote : project.token;
      const fresh = client ? await readPool(client, d.amm, project.spotPoolId) : project.spot;
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
      const permit = await tx.permit(tokenIn, d.router, parsed).catch(() => undefined);
      if (permit === undefined) return;
      if (!permit && !(await tx.ensureAllowance(tokenIn, d.router, parsed, buy ? "USDC" : sym)))
        return;
      const ok = await tx.run({
        title: buy
          ? `Buy ${sym} with ${formatUsd(parsed)}`
          : `Sell ${formatToken(parsed, 18, sym)}`,
        request: txs.swapSpot(d, project.treasury, buy, parsed, minOut, permit ?? undefined),
      });
      if (ok) setAmount("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title={`Trade $${sym}`}>
      <div className="flex flex-col gap-4">
        <Segmented
          label="Swap direction"
          value={side}
          onChange={(v) => {
            setSide(v);
            setAmount("");
          }}
          options={[
            { value: "buy", label: "Buy" },
            { value: "sell", label: "Sell" },
          ]}
        />
        <AmountInput
          label={buy ? "USDC to spend" : `${sym} to sell`}
          value={amount}
          onChange={setAmount}
          symbol={buy ? "USDC" : sym}
          invalid={insufficient}
          balanceLabel={
            tx.isConnected
              ? `Balance ${buy ? formatUsd(balance) : formatToken(balance, 18)}`
              : undefined
          }
          onMax={
            tx.isConnected
              ? () => setAmount((Number(balance) / 10 ** inDecimals).toString())
              : undefined
          }
        />
        {parsed > 0n && (
          <>
            <KV
              rows={[
                ["You receive", buy ? formatToken(q.amountOut, 18, sym) : formatUsd(q.amountOut)],
                ["Price impact", formatBps(q.priceImpactBps)],
                [
                  `Min after ${formatBps(slippage)}`,
                  buy
                    ? formatToken(withSlippage(q.amountOut, slippage), 18, sym)
                    : formatUsd(withSlippage(q.amountOut, slippage)),
                ],
              ]}
            />
            <SlippageControl />
          </>
        )}
        <Button
          variant="accent"
          disabled={parsed === 0n || insufficient || q.amountOut === 0n}
          loading={busy}
          onClick={submit}
        >
          {insufficient ? "Insufficient balance" : buy ? `Buy ${sym}` : `Sell ${sym}`}
        </Button>
      </div>
    </Panel>
  );
}

/** Founder controls: streamed budget + performance unlocks. Only rendered for the founder. */
export function FounderPanel({ project }: { project: ProjectView }) {
  const tx = useMonetaTx();
  const now = useChainNow();
  if (!tx.address || tx.address.toLowerCase() !== project.founder.toLowerCase()) return null;
  const sym = project.tokenMeta.symbol;
  return (
    <Panel title="Founder">
      <div className="flex flex-col gap-4">
        <div>
          <p className="figure-lg">{formatUsd(project.budgetAccrued)}</p>
          <p className="mono-xs mt-1 text-fg-3">
            budget accrued · {formatUsd(project.budgetPerMonth)} / month
          </p>
        </div>
        <Button
          variant="accent"
          disabled={project.budgetAccrued === 0n}
          onClick={() =>
            tx.run({ title: "Claim budget", request: txs.claimBudget(project.treasury) })
          }
        >
          Claim budget
        </Button>
        {project.perf.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-line-strong pt-4">
            <p className="mono-xs text-fg-3 uppercase">Performance package</p>
            {project.perf.map((pf, i) => {
              const target = (project.raisePrice * BigInt(pf.multipleX100)) / 100n;
              const cliff = now !== undefined && now < project.perfCliffEnd;
              const windowLeft =
                pf.unlockStart > 0 && now !== undefined
                  ? pf.unlockStart + project.perfUnlockWindow - now
                  : undefined;
              return (
                <div key={i} className="flex flex-col gap-2 rounded-[8px] border border-line p-3">
                  <p className="body-sm">
                    {(pf.multipleX100 / 100).toFixed(1)}× · {formatToken(pf.amount, 18, sym)}
                  </p>
                  <p className="mono-xs text-fg-3">
                    target {formatTokenPrice(target)} TWAP
                    {cliff ? ` · cliff ${formatCountdown(project.perfCliffEnd - (now ?? 0))}` : ""}
                  </p>
                  {pf.done ? (
                    <p className="mono-xs text-pass">▲ Unlocked</p>
                  ) : pf.unlockStart > 0 ? (
                    <Button
                      size="sm"
                      variant="tertiary"
                      disabled={windowLeft !== undefined && windowLeft > 0}
                      onClick={() =>
                        tx.run({
                          title: `Complete unlock ${i + 1}`,
                          request: txs.completePerformanceUnlock(project.treasury, i),
                        })
                      }
                    >
                      {windowLeft !== undefined && windowLeft > 0
                        ? `Complete in ${formatCountdown(windowLeft)}`
                        : "Complete unlock"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="tertiary"
                      disabled={cliff}
                      onClick={() =>
                        tx.run({
                          title: `Start unlock ${i + 1}`,
                          request: txs.startPerformanceUnlock(project.treasury, i),
                        })
                      }
                    >
                      Start unlock
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}

/** After a passed Redemption: holders burn tokens for their pro-rata share of the treasury (exit at NAV). */
export function RedemptionPanel({ project }: { project: ProjectView }) {
  const tx = useMonetaTx();
  const bal = useBalances(tx.address, [project.token]);
  const [amount, setAmount] = useState("");
  const sym = project.tokenMeta.symbol;
  const balance = bal.data?.[project.token] ?? 0n;
  const parsed = parse(amount, 18);
  const payout =
    project.redemptionSupply > 0n
      ? (parsed * project.redemptionQuote) / project.redemptionSupply
      : 0n;
  return (
    <Panel title="Redeem at NAV">
      <div className="flex flex-col gap-4">
        <p className="body-sm text-fg-2">
          Holders voted with markets to wind down. Burn {sym} for a fixed pro-rata share of the
          treasury — order doesn&apos;t matter.
        </p>
        <AmountInput
          label={`${sym} to redeem`}
          value={amount}
          onChange={setAmount}
          symbol={sym}
          invalid={parsed > balance}
          balanceLabel={tx.isConnected ? `Balance ${formatToken(balance, 18)}` : undefined}
          onMax={tx.isConnected ? () => setAmount((Number(balance) / 1e18).toString()) : undefined}
        />
        {parsed > 0n && <KV rows={[["You receive", formatUsd(payout)]]} />}
        <Button
          variant="accent"
          disabled={parsed === 0n || parsed > balance}
          onClick={async () => {
            const ok = await tx.run({
              title: `Redeem ${formatToken(parsed, 18, sym)}`,
              request: txs.redeem(project.treasury, parsed),
            });
            if (ok) setAmount("");
          }}
        >
          Redeem
        </Button>
      </div>
    </Panel>
  );
}
