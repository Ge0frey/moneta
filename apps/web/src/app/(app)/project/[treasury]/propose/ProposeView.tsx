"use client";

import {
  actionTitle,
  formatBps,
  formatDuration,
  formatToken,
  formatUsd,
  NO_PERMIT,
  ProjectState,
  quoteSwap,
  treasuryAbi,
  txs,
  type Bounds,
  type PermitArgs,
  type ProjectView,
  type ProposalAction,
} from "@moneta/sdk";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  decodeEventLog,
  erc20Abi,
  isAddress,
  isHex,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { usePublicClient } from "wagmi";
import { Section } from "@/components/layout/Frame";
import { Button } from "@/components/ui/button";
import { KV, PageHeader, Panel } from "@/components/ui/display";
import { Field, Input, RadioCards, Segmented } from "@/components/ui/forms";
import { MemoEditor } from "@/components/ui/memo-editor";
import { Eyebrow, Tag } from "@/components/ui/pills";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { QuoteFaucet } from "@/components/tx/QuoteFaucet";
import { quoteSym, requireDeployment } from "@/lib/env";
import { useBalances, useFactoryState, useProjectState } from "@/lib/hooks/chain";
import { useMonetaTx } from "@/lib/hooks/tx";
import { describeAction } from "../proposal/[id]/ProposalView";
import {
  ConfigEditor,
  fromCfgInput,
  thresholdCopy,
  toCfgInput,
} from "@/components/governance/ConfigEditor";

type Kind = ProposalAction["type"];

const kinds = (qSym: string): { value: Kind; title: string; sub: string; teamOnly?: boolean }[] => [
  {
    value: "TrancheRelease",
    title: "Release tranche",
    sub: `Unlock a milestone's ${qSym} to the founder`,
    teamOnly: true,
  },
  { value: "Transfer", title: "Transfer", sub: `Send ${qSym} or tokens from the treasury` },
  { value: "SetBudget", title: "Set budget", sub: "Change the founder's monthly stream" },
  { value: "Mint", title: "Mint", sub: "Issue new tokens, e.g. to an OTC buyer" },
  { value: "Buyback", title: "Buyback", sub: "Buy and burn on the spot pool" },
  { value: "UpdateConfig", title: "Governance config", sub: "Windows, thresholds, bond" },
  { value: "SetFounder", title: "Set founder", sub: "Rotate the founder address" },
  { value: "Call", title: "Arbitrary call", sub: "Any contract call from the treasury" },
  { value: "Redeem", title: "Redemption", sub: "Wind down; holders exit at NAV" },
];

const MEMO_TEMPLATE: Partial<Record<Kind, string>> = {
  TrancheRelease:
    "## Milestone delivered\n\nWhat shipped, with links.\n\n## What the tranche funds next\n\n",
  Redeem: "## Why wind down\n\nWhy holders are better off taking the treasury back now.\n",
};
const DEFAULT_MEMO =
  "## Why\n\nWhat this does and why it raises the token's value.\n\n## Risks\n\n";

function parseAmount(v: string, decimals: number): bigint | undefined {
  try {
    return v.trim() ? parseUnits(v.trim(), decimals) : undefined;
  } catch {
    return undefined;
  }
}

export function ProposeView({ treasury }: { treasury: Address }) {
  const project = useProjectState(treasury);
  const factory = useFactoryState();
  if (project.isError)
    return (
      <ErrorState
        className="mt-12"
        title="Project not found"
        body="This address isn't a Moneta treasury on this network."
      />
    );
  if (!project.data || !factory.data)
    return <Skeleton className="mt-12 h-[640px] w-full rounded-[16px]" />;
  if (project.data.state === ProjectState.Redeemed) {
    return (
      <EmptyState
        className="mt-12"
        motif="fork"
        title="This project was redeemed"
        body="Holders voted to wind down, so there's nothing left to propose. Remaining holders can redeem at NAV."
        action={
          <Button asChild variant="tertiary">
            <Link href={`/project/${treasury}`}>Back to project</Link>
          </Button>
        }
      />
    );
  }
  return <Composer project={project.data} bounds={factory.data.bounds} />;
}

function Composer({ project: p, bounds }: { project: ProjectView; bounds: Bounds }) {
  const tx = useMonetaTx();
  const router = useRouter();
  const client = usePublicClient();
  const sym = p.tokenMeta.symbol;
  const qSym = quoteSym(p.quote);
  const isFounder = !!tx.address && tx.address.toLowerCase() === p.founder.toLowerCase();
  const unreleased = p.tranches.map((t, i) => ({ ...t, i })).filter((t) => !t.released);

  const [kindState, setKind] = useState<Kind>();
  const kind: Kind = kindState ?? (isFounder && unreleased.length ? "TrancheRelease" : "Transfer");
  const [tranche, setTranche] = useState<number>(unreleased[0]?.i ?? 0);
  const [asset, setAsset] = useState<"quote" | "token" | "custom">("quote");
  const [customToken, setCustomToken] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [minOut, setMinOut] = useState("");
  const [target, setTarget] = useState("");
  const [calldata, setCalldata] = useState("0x");
  const [cfg, setCfg] = useState(() => toCfgInput(p.config));
  const [memoState, setMemo] = useState<string>();
  const memo = memoState ?? MEMO_TEMPLATE[kind] ?? DEFAULT_MEMO;
  const [busy, setBusy] = useState(false);
  const bal = useBalances(tx.address, [p.quote]);

  const customDecimals = useQuery({
    queryKey: ["chain", "decimals", customToken],
    enabled: asset === "custom" && isAddress(customToken) && !!client,
    queryFn: () =>
      client!.readContract({
        address: customToken as Address,
        abi: erc20Abi,
        functionName: "decimals",
      }),
  });

  const transferToken: Address | undefined =
    asset === "quote"
      ? p.quote
      : asset === "token"
        ? p.token
        : isAddress(customToken)
          ? (customToken as Address)
          : undefined;
  const transferDecimals = asset === "quote" ? 6 : asset === "token" ? 18 : customDecimals.data;
  const mintCap = (p.tokenMeta.totalSupply * BigInt(bounds.maxMintBps)) / 10_000n;
  const spotQuote = (quoteIn: bigint) =>
    quoteSwap(
      { reserveBase: p.spot.reserveBase, reserveQuote: p.spot.reserveQuote, feeBps: p.spot.feeBps },
      false,
      quoteIn,
    ).amountOut;

  const { action, errors } = useMemo(() => {
    const e: Record<string, string> = {};
    let a: ProposalAction | undefined;
    const addr = (v: string, key: string) => {
      if (!v) e[key] = "Required";
      else if (!isAddress(v)) e[key] = "Not a valid address";
      else if (/^0x0{40}$/i.test(v)) e[key] = "Can't be the zero address";
      return v as Address;
    };
    switch (kind) {
      case "TrancheRelease":
        if (!isFounder) e.kind = "Only the founder can propose a tranche release";
        else if (!unreleased.length) e.kind = "Every tranche has been released";
        a = { type: "TrancheRelease", index: tranche };
        break;
      case "Transfer": {
        const toA = addr(to, "to");
        if (asset === "custom") addr(customToken, "token");
        const amt =
          transferDecimals === undefined ? undefined : parseAmount(amount, transferDecimals);
        if (!amount) e.amount = "Required";
        else if (!amt) e.amount = "Enter an amount above zero";
        else if (asset === "quote" && amt > p.availableQuote)
          e.amount = `Treasury has ${formatUsd(p.availableQuote)} available`;
        if (transferToken && amt)
          a = { type: "Transfer", token: transferToken, to: toA, amount: amt };
        break;
      }
      case "SetBudget": {
        const v = amount === "0" ? 0n : parseAmount(amount, 6);
        if (v === undefined) e.amount = "Enter a monthly amount (0 stops the stream)";
        else a = { type: "SetBudget", perMonth: v };
        break;
      }
      case "Mint": {
        const toA = addr(to, "to");
        const amt = parseAmount(amount, 18);
        if (!amt) e.amount = "Enter an amount above zero";
        else if (amt > mintCap)
          e.amount = `At most ${formatToken(mintCap, 18, sym)} (${formatBps(bounds.maxMintBps, { digits: 0 })} of supply) per proposal`;
        if (amt) a = { type: "Mint", to: toA, amount: amt };
        break;
      }
      case "Buyback": {
        const q = parseAmount(amount, 6);
        const m = minOut ? parseAmount(minOut, 18) : 0n;
        if (!q) e.amount = `Enter a ${qSym} amount above zero`;
        else if (q > p.availableQuote)
          e.amount = `Treasury has ${formatUsd(p.availableQuote)} available`;
        if (m === undefined) e.minOut = "Not a valid amount";
        if (q && m !== undefined) a = { type: "Buyback", quoteIn: q, minOut: m };
        break;
      }
      case "UpdateConfig": {
        const { config, errors: ce } = fromCfgInput(cfg, bounds);
        Object.assign(e, ce);
        if (config) a = { type: "UpdateConfig", config };
        break;
      }
      case "SetFounder":
        a = { type: "SetFounder", founder: addr(to, "to") };
        break;
      case "Call": {
        const t = addr(target, "target");
        // mirrors Treasury._forbiddenTarget
        const d = requireDeployment();
        const forbidden = [p.treasury, p.token, d.vault, d.amm, d.factory].map((x) =>
          x.toLowerCase(),
        );
        if (isAddress(target) && forbidden.includes(target.toLowerCase()))
          e.target =
            "Calls to the treasury, its token, the vault, the AMM or the factory aren't allowed";
        if (!isHex(calldata) || calldata.length % 2 !== 0)
          e.calldata = "Hex calldata, e.g. 0xa9059cbb…";
        a = { type: "Call", target: t, data: calldata as Hex };
        break;
      }
      case "Redeem":
        a = { type: "Redeem" };
        break;
    }
    const memoBytes = new TextEncoder().encode(memo).length;
    if (!memo.trim()) e.memo = "Explain the proposal";
    else if (memoBytes > bounds.maxMemoBytes)
      e.memo = `Memo is ${memoBytes} bytes; the limit is ${bounds.maxMemoBytes}`;
    return { action: Object.keys(e).length ? undefined : a, errors: e };
  }, [
    kind,
    isFounder,
    unreleased.length,
    tranche,
    to,
    asset,
    customToken,
    transferDecimals,
    amount,
    transferToken,
    p,
    minOut,
    mintCap,
    sym,
    qSym,
    bounds,
    cfg,
    target,
    calldata,
    memo,
  ]);

  const theta =
    kind === "TrancheRelease"
      ? p.config.thetaTrancheBps
      : isFounder
        ? p.config.thetaTeamBps
        : p.config.thetaCommunityBps;
  const active = p.activeProposalId > 0n;
  const queued = p.queuedRedemptionId > 0n;
  const slot = queued
    ? {
        ok: false,
        text: `Redemption #${p.queuedRedemptionId} is queued; new proposals wait for it`,
      }
    : active && kind !== "Redeem"
      ? { ok: false, text: `Proposal #${p.activeProposalId} is live. One market at a time` }
      : active
        ? { ok: true, text: `Queues behind #${p.activeProposalId}, then opens automatically` }
        : { ok: true, text: "Free. Markets open as soon as you submit" };
  const bond = p.config.bond;
  const usdcBal = bal.data?.[p.quote] ?? 0n;
  const shortBond = tx.isConnected && bond > usdcBal;
  const migrateQuote = (p.spot.reserveQuote * BigInt(p.config.proposalLiquidityBps)) / 10_000n;
  const migrateBase = (p.spot.reserveBase * BigInt(p.config.proposalLiquidityBps)) / 10_000n;

  const submit = async () => {
    if (!action || !(await tx.ensureReady())) return;
    setBusy(true);
    try {
      let permit: PermitArgs | null | undefined = NO_PERMIT;
      if (bond > 0n) {
        permit = await tx.permit(p.quote, p.treasury, bond).catch(() => undefined);
        if (permit === undefined) return;
        if (!permit && !(await tx.ensureAllowance(p.quote, p.treasury, bond, `${qSym} bond`)))
          return;
      }
      const receipt = await tx.run({
        title: `Propose: ${actionTitle(action)}`,
        request: txs.propose(p.treasury, action, memo, permit ?? NO_PERMIT),
      });
      if (!receipt) return;
      for (const log of receipt.logs) {
        try {
          const ev = decodeEventLog({ abi: treasuryAbi, data: log.data, topics: log.topics });
          if (ev.eventName === "ProposalCreated") {
            router.push(`/project/${p.treasury}/proposal/${(ev.args as { id: bigint }).id}`);
            return;
          }
        } catch {
          /* logs from other contracts */
        }
      }
      router.push(`/project/${p.treasury}`);
    } finally {
      setBusy(false);
    }
  };

  const kindOptions = kinds(qSym).map((k) => ({
    value: k.value,
    title: k.title,
    sub: k.teamOnly && !isFounder ? "Founder only" : k.sub,
    disabled:
      (k.teamOnly && (!isFounder || !unreleased.length)) ||
      (active && !queued && k.value !== "Redeem") ||
      queued,
  }));

  return (
    <>
      <PageHeader
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow>New Proposal</Eyebrow>
            <Tag>${sym}</Tag>
          </div>
        }
        title="Ask the market."
        sub={`Propose a change to ${p.tokenMeta.name}'s treasury. Two markets open, one for each world, and the verdict follows whichever one prices ${sym} higher.`}
        actions={
          <Button asChild variant="tertiary">
            <Link href={`/project/${p.treasury}`}>Cancel</Link>
          </Button>
        }
      />
      <Section dense className="pb-24">
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="flex flex-col gap-4 lg:col-span-3">
            <Panel title={<StepTitle n={1} title="Action" />}>
              <RadioCards
                label="Proposal type"
                value={kind}
                onChange={(v) => setKind(v)}
                options={kindOptions}
              />
              {errors.kind && (
                <p role="alert" className="caption mt-3 text-fail">
                  ⚠ {errors.kind}
                </p>
              )}
            </Panel>

            <Panel title={<StepTitle n={2} title="Details" />}>
              <div className="flex flex-col gap-5">
                {kind === "TrancheRelease" &&
                  (unreleased.length ? (
                    <RadioCards
                      label="Tranche"
                      columns={4}
                      value={tranche}
                      onChange={setTranche}
                      options={p.tranches.map((t, i) => ({
                        value: i,
                        title: `Tranche ${i + 1}`,
                        sub: t.released
                          ? "Released"
                          : `${formatUsd(t.amount)} · ${formatBps(t.bps, { digits: 0 })}`,
                        disabled: t.released,
                      }))}
                    />
                  ) : (
                    <p className="body-sm text-fg-3">Every tranche has been released.</p>
                  ))}

                {kind === "Transfer" && (
                  <>
                    <Segmented
                      label="Asset"
                      value={asset}
                      onChange={(v) => {
                        setAsset(v);
                        setAmount("");
                      }}
                      options={[
                        { value: "quote", label: qSym },
                        { value: "token", label: sym },
                        { value: "custom", label: "Other ERC-20" },
                      ]}
                    />
                    {asset === "custom" && (
                      <Field label="Token address" htmlFor="token" error={errors.token}>
                        <Input
                          id="token"
                          value={customToken}
                          onChange={(e) => setCustomToken(e.target.value.trim())}
                          placeholder="0x…"
                          autoComplete="off"
                          spellCheck={false}
                          invalid={!!errors.token && !!customToken}
                        />
                      </Field>
                    )}
                    <AddressField
                      id="to"
                      label="Recipient"
                      value={to}
                      onChange={setTo}
                      error={to ? errors.to : undefined}
                    />
                    <Field
                      label="Amount"
                      htmlFor="amount"
                      error={amount ? errors.amount : undefined}
                      hint={
                        asset === "quote"
                          ? `Treasury has ${formatUsd(p.availableQuote)} available`
                          : undefined
                      }
                    >
                      <Input
                        id="amount"
                        inputMode="decimal"
                        autoComplete="off"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        suffix={asset === "quote" ? qSym : asset === "token" ? sym : ""}
                        invalid={!!amount && !!errors.amount}
                      />
                    </Field>
                  </>
                )}

                {kind === "SetBudget" && (
                  <Field
                    label="New budget per month"
                    htmlFor="budget"
                    error={amount ? errors.amount : undefined}
                    hint={`Currently ${formatUsd(p.budgetPerMonth)} per month, streamed per second. Accrued budget is settled first.`}
                  >
                    <Input
                      id="budget"
                      inputMode="decimal"
                      autoComplete="off"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      suffix={qSym}
                      invalid={!!amount && !!errors.amount}
                    />
                  </Field>
                )}

                {kind === "Mint" && (
                  <>
                    <AddressField
                      id="to"
                      label="Recipient"
                      value={to}
                      onChange={setTo}
                      error={to ? errors.to : undefined}
                    />
                    <Field
                      label="Tokens to mint"
                      htmlFor="mint"
                      error={amount ? errors.amount : undefined}
                      hint={`Cap: ${formatToken(mintCap, 18, sym)} per proposal`}
                    >
                      <Input
                        id="mint"
                        inputMode="decimal"
                        autoComplete="off"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        suffix={sym}
                        invalid={!!amount && !!errors.amount}
                      />
                    </Field>
                  </>
                )}

                {kind === "Buyback" && (
                  <>
                    <Field
                      label={`${qSym} to spend`}
                      htmlFor="bb"
                      error={amount ? errors.amount : undefined}
                      hint={`Treasury has ${formatUsd(p.availableQuote)} available`}
                    >
                      <Input
                        id="bb"
                        inputMode="decimal"
                        autoComplete="off"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        suffix={qSym}
                        invalid={!!amount && !!errors.amount}
                      />
                    </Field>
                    <Field
                      label="Minimum tokens out"
                      htmlFor="minout"
                      error={errors.minOut}
                      hint={
                        parseAmount(amount, 6)
                          ? `At today's spot this buys ~${formatToken(spotQuote(parseAmount(amount, 6)!), 18, sym)}. The buy executes after the verdict, so leave headroom.`
                          : "Slippage guard for the swap at execution. Leave empty for none."
                      }
                    >
                      <Input
                        id="minout"
                        inputMode="decimal"
                        autoComplete="off"
                        value={minOut}
                        onChange={(e) => setMinOut(e.target.value)}
                        suffix={sym}
                        invalid={!!errors.minOut}
                      />
                    </Field>
                  </>
                )}

                {kind === "UpdateConfig" && (
                  <ConfigEditor
                    cfg={cfg}
                    setCfg={setCfg}
                    errors={errors}
                    bounds={bounds}
                    quoteSymbol={qSym}
                  />
                )}

                {kind === "SetFounder" && (
                  <AddressField
                    id="to"
                    label="New founder address"
                    value={to}
                    onChange={setTo}
                    error={to ? errors.to : undefined}
                    hint="A Safe is recommended. The founder claims budget and proposes tranche releases."
                  />
                )}

                {kind === "Call" && (
                  <>
                    <AddressField
                      id="target"
                      label="Target contract"
                      value={target}
                      onChange={setTarget}
                      error={target ? errors.target : undefined}
                    />
                    <Field
                      label="Calldata"
                      htmlFor="calldata"
                      error={errors.calldata}
                      hint="Executed from the treasury with zero value. The market is the safeguard, so explain exactly what this does."
                    >
                      <Input
                        id="calldata"
                        value={calldata}
                        onChange={(e) => setCalldata(e.target.value.trim())}
                        className="mono-sm"
                        autoComplete="off"
                        spellCheck={false}
                        invalid={!!errors.calldata}
                      />
                    </Field>
                  </>
                )}

                {kind === "Redeem" && (
                  <div className="rounded-[8px] border border-warning/40 bg-warning-subtle p-4 body-sm text-fg-2">
                    If this passes, the budget stops, liquidity is pulled, treasury-held {sym} is
                    burned, and every holder can redeem {sym} for a fixed pro-rata share of{" "}
                    {formatUsd(p.nav.quoteAssets)}, about {formatUsd(p.nav.navPerToken)} per token
                    at today&apos;s NAV.
                    {active && " A redemption can queue behind the live proposal."}
                  </div>
                )}
              </div>
            </Panel>

            <Panel title={<StepTitle n={3} title="Memo" />}>
              <MemoEditor
                label="Proposal memo"
                value={memo}
                onChange={setMemo}
                maxBytes={bounds.maxMemoBytes}
              />
            </Panel>
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
            <Panel title="Summary">
              <div className="flex flex-col gap-4">
                <p className="body-sm text-fg">
                  {action ? (
                    describeAction(action, p)
                  ) : (
                    <span className="text-fg-3">Complete the details to preview.</span>
                  )}
                </p>
                <KV
                  rows={[
                    ["Threshold", thresholdCopy(theta)],
                    ["Bond", bond > 0n ? formatUsd(bond) : "None"],
                    ["Warm-up", formatDuration(p.config.warmup)],
                    ["Trading", formatDuration(p.config.duration)],
                    [
                      "Liquidity",
                      `${formatUsd(migrateQuote)} + ${formatToken(migrateBase, 18)} ${sym}`,
                    ],
                  ]}
                />
                <p className={slot.ok ? "mono-xs text-fg-3" : "mono-xs text-warning"}>
                  {slot.ok ? "◉" : "⚠"} {slot.text}
                </p>
                {bond > 0n && (
                  <p className="mono-xs text-fg-3">
                    The bond comes back if the proposal passes. If it fails, the treasury keeps it.
                  </p>
                )}
                <Button
                  variant="accent"
                  size="lg"
                  disabled={!action || !slot.ok || shortBond}
                  loading={busy}
                  onClick={submit}
                >
                  {shortBond ? `Need ${formatUsd(bond)} for the bond` : "Submit proposal"}
                </Button>
                {bond > 0n && (
                  <QuoteFaucet quote={p.quote} balance={bal.data ? usdcBal : undefined} />
                )}
              </div>
            </Panel>
          </aside>
        </div>
      </Section>
    </>
  );
}

function StepTitle({ n, title }: { n: number; title: string }) {
  return (
    <span className="flex items-baseline gap-3">
      <span className="mono-sm text-fg-3">{String(n).padStart(2, "0")} / 03</span>
      {title}
    </span>
  );
}

function AddressField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
}) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
        placeholder="0x…"
        autoComplete="off"
        spellCheck={false}
        className="mono-sm"
        invalid={!!error}
      />
    </Field>
  );
}
