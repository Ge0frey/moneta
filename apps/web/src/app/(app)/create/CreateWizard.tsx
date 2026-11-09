"use client";

import {
  chainNow,
  FAUCETS,
  formatBps,
  formatDuration,
  formatToken,
  formatTokenPrice,
  formatUsd,
  monetaFactoryAbi,
  quoteAssets,
  txs,
  type FactoryState,
  type RaiseParams,
} from "@moneta/sdk";
import { Check, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { decodeEventLog, type Address, type PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { Section } from "@/components/layout/Frame";
import { Button } from "@/components/ui/button";
import { KV, PageHeader, Panel } from "@/components/ui/display";
import { Field, Input, Segmented } from "@/components/ui/forms";
import { MemoEditor } from "@/components/ui/memo-editor";
import { Eyebrow } from "@/components/ui/pills";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { cn } from "@/lib/cn";
import { IS_TESTNET, quoteSym, requireDeployment } from "@/lib/env";
import { useFactoryState } from "@/lib/hooks/chain";
import { useMonetaTx } from "@/lib/hooks/tx";
import { ConfigEditor } from "@/components/governance/ConfigEditor";
import {
  byteLen,
  initialDraft,
  launchAt,
  memoTemplate,
  STEP_FIELDS,
  STEPS,
  validate,
  type Draft,
  type Unit,
} from "@/lib/raise-form";

export function CreateWizard() {
  const factory = useFactoryState();
  if (factory.isError)
    return (
      <ErrorState
        className="mt-12"
        title="Couldn't reach the Moneta factory"
        body="Check your network connection and that Moneta is deployed on this chain."
        onRetry={() => factory.refetch()}
      />
    );
  if (!factory.data) return <Skeleton className="mt-12 h-[640px] w-full rounded-[16px]" />;
  return <Wizard factory={factory.data} />;
}

function Wizard({ factory }: { factory: FactoryState }) {
  const b = factory.bounds;
  const tx = useMonetaTx();
  const router = useRouter();
  const client = usePublicClient() as PublicClient | undefined;
  const [d, setD] = useState<Draft>(() => initialDraft(b));
  const [memoState, setMemo] = useState<string>();
  const memo = memoState ?? memoTemplate(d);
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [showErrors, setShowErrors] = useState<Record<number, boolean>>({});
  const [showGov, setShowGov] = useState(false);
  const [busy, setBusy] = useState(false);
  const quotes = quoteAssets(requireDeployment());
  const [quote, setQuote] = useState<Address>(quotes[0]!.address);
  const qSym = quoteSym(quote);
  const founder = d.founder || tx.address || "";
  const draft = { ...d, founder };
  const v = validate(draft, b);
  const errors = { ...v.errors } as Record<string, string>;
  if (!memo.trim()) errors.memo = "Write the Raise Memo";
  else if (byteLen(memo) > b.maxMemoBytes)
    errors.memo = `Memo is ${byteLen(memo).toLocaleString()} bytes; the limit is ${b.maxMemoBytes.toLocaleString()}`;
  const stepErrors = (i: number) => Object.keys(errors).filter(STEP_FIELDS[i]!);
  const err = (k: string, i: number) => (showErrors[i] ? errors[k] : undefined);
  const set = <K extends keyof Draft>(k: K, val: Draft[K]) => setD((x) => ({ ...x, [k]: val }));

  const next = () => {
    if (stepErrors(step).length) {
      setShowErrors((s) => ({ ...s, [step]: true }));
      return;
    }
    const n = Math.min(step + 1, STEPS.length - 1);
    setStep(n);
    setReached((r) => Math.max(r, n));
  };

  const publish = async () => {
    if (!v.params || errors.memo || !client || !(await tx.ensureReady())) return;
    setBusy(true);
    try {
      const now = Number(await chainNow(client));
      // `start` below block.timestamp is normalised to "now" by the factory; 15s slack covers inclusion latency.
      const end = now + Math.min(v.params.windowSec + 15, b.maxRaiseWindow);
      const { windowSec: _w, ...rest } = v.params;
      const params: RaiseParams = { ...rest, quote, start: 0, end };
      const receipt = await tx.run({
        title: `Publish ${params.symbol} raise`,
        request: txs.createRaise(requireDeployment(), params, memo),
      });
      if (!receipt) return;
      for (const log of receipt.logs) {
        try {
          const ev = decodeEventLog({ abi: monetaFactoryAbi, data: log.data, topics: log.topics });
          if (ev.eventName === "RaiseCreated") {
            router.push(`/raise/${(ev.args as { raise: Address }).raise}`);
            return;
          }
        } catch {
          /* other logs */
        }
      }
      router.push("/explore");
    } finally {
      setBusy(false);
    }
  };

  const summaries: ReactNode[] = [
    d.name ? `${d.name} · $${d.symbol}` : "",
    v.price && v.min && v.max
      ? `${qSym} · ${formatTokenPrice(v.price)} · ${formatUsd(v.min, 6, { compact: true })} to ${formatUsd(v.max, 6, { compact: true })} · ${formatDuration(v.windowSec)}`
      : "",
    `${d.tranches.length} tranche${d.tranches.length === 1 ? "" : "s"} · ${v.budget !== undefined ? formatUsd(v.budget) : "?"}/mo budget${d.perf.length ? ` · ${d.perf.length} perf` : ""}`,
    `${byteLen(memo).toLocaleString()} bytes`,
    "",
  ];

  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow className="w-fit">Create a Raise</Eyebrow>}
        title="Raise with markets, not promises."
        sub="Anyone can open a raise. Backers get one price, a full refund below your minimum, and a treasury that only pays out when markets expect it to raise the token's value."
      />
      <Section dense className="pb-24">
        {factory.creationPaused && (
          <ErrorState
            className="mb-4"
            title="New raises are paused"
            body="The protocol has paused raise creation. Existing raises and treasuries are unaffected."
          />
        )}
        <ol className="border-t border-l border-line-strong">
          {STEPS.map((title, i) => {
            const done = i < step || (i <= reached && i !== step && stepErrors(i).length === 0);
            const open = i === step;
            return (
              <li key={title} className="border-r border-b border-line-strong bg-canvas">
                <h2>
                  <button
                    type="button"
                    disabled={i > reached}
                    onClick={() => setStep(i)}
                    aria-expanded={open}
                    aria-controls={`step-${i}`}
                    className={cn(
                      "flex w-full items-center gap-4 px-5 py-4 text-left transition-colors",
                      open ? "bg-surface-1" : "hover:bg-surface-1 disabled:hover:bg-transparent",
                    )}
                  >
                    <span className="mono-sm text-fg-3 tabular">
                      {String(i + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
                    </span>
                    <span className={cn("body flex-1", i > reached ? "text-fg-3" : "text-fg")}>
                      {title}
                    </span>
                    {!open && done && summaries[i] && (
                      <span className="mono-xs hidden max-w-[50%] truncate text-fg-3 sm:block">
                        {summaries[i]}
                      </span>
                    )}
                    <span aria-hidden className="w-4 text-center text-fg-2">
                      {open ? "◉" : done ? <Check className="inline size-4" /> : "○"}
                    </span>
                  </button>
                </h2>
                {open && (
                  <div
                    id={`step-${i}`}
                    className="border-t border-line-strong bg-surface-1 px-5 py-6"
                  >
                    {i === 0 && (
                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field
                          label="Project name"
                          htmlFor="name"
                          error={err("name", 0)}
                          hint="Also the token name"
                        >
                          <Input
                            id="name"
                            value={d.name}
                            onChange={(e) => set("name", e.target.value)}
                            placeholder="Lumen"
                            autoComplete="off"
                            maxLength={32}
                            invalid={!!err("name", 0)}
                          />
                        </Field>
                        <Field label="Ticker" htmlFor="symbol" error={err("symbol", 0)}>
                          <Input
                            id="symbol"
                            value={d.symbol}
                            onChange={(e) =>
                              set("symbol", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                            }
                            placeholder="LUM"
                            autoComplete="off"
                            maxLength={11}
                            invalid={!!err("symbol", 0)}
                          />
                        </Field>
                        <Field
                          className="sm:col-span-2"
                          label="Founder address"
                          htmlFor="founder"
                          error={err("founder", 0)}
                          hint="Receives the streamed budget and proposes tranche releases. A Safe is recommended. Defaults to your wallet."
                        >
                          <Input
                            id="founder"
                            value={founder}
                            onChange={(e) => set("founder", e.target.value.trim())}
                            placeholder="0x…"
                            className="mono-sm"
                            autoComplete="off"
                            spellCheck={false}
                            invalid={!!err("founder", 0)}
                          />
                        </Field>
                      </div>
                    )}

                    {i === 1 && (
                      <div className="grid gap-5 sm:grid-cols-2">
                        {quotes.length > 1 && (
                          <div className="flex flex-col gap-1.5 sm:col-span-2">
                            <p className="body-sm font-medium text-fg">Raise in</p>
                            <div className="sm:w-[320px]">
                              <Segmented
                                label="Raise currency"
                                value={quote}
                                onChange={setQuote}
                                options={quotes.map((q) => ({ value: q.address, label: q.symbol }))}
                              />
                            </div>
                            <p className="caption text-fg-3">
                              {quotes.find((q) => q.address === quote)?.test
                                ? `${qSym} is a test token anyone can mint, 10,000 at a time, from the raise page. Use it for demos and large-amount testing.`
                                : IS_TESTNET
                                  ? "Circle testnet USDC. Its faucet gives 20 USDC every 2 hours."
                                  : "The protocol's primary quote asset."}
                            </p>
                          </div>
                        )}
                        <Field
                          label="Price per token"
                          htmlFor="price"
                          error={err("price", 1)}
                          hint="Fixed. Every backer pays the same price."
                        >
                          <Input
                            id="price"
                            inputMode="decimal"
                            autoComplete="off"
                            value={d.price}
                            onChange={(e) => set("price", e.target.value)}
                            suffix={qSym}
                            invalid={!!err("price", 1)}
                          />
                        </Field>
                        <Field
                          label="Raise window"
                          htmlFor="window"
                          error={err("window", 1)}
                          hint={`${formatDuration(b.minRaiseWindow)} to ${formatDuration(b.maxRaiseWindow)} · opens when published`}
                        >
                          <div className="flex gap-2">
                            <Input
                              id="window"
                              inputMode="decimal"
                              autoComplete="off"
                              value={d.window}
                              onChange={(e) => set("window", e.target.value)}
                              invalid={!!err("window", 1)}
                            />
                            <div className="w-[220px] shrink-0">
                              <Segmented
                                label="Window unit"
                                value={d.windowUnit}
                                onChange={(u) => set("windowUnit", u)}
                                options={[
                                  { value: "min", label: "min" },
                                  { value: "hour", label: "hours" },
                                  { value: "day", label: "days" },
                                ]}
                              />
                            </div>
                          </div>
                        </Field>
                        <Field
                          label="Minimum raise"
                          htmlFor="min"
                          error={err("min", 1)}
                          hint="Below this, every backer is refunded in full."
                        >
                          <Input
                            id="min"
                            inputMode="decimal"
                            autoComplete="off"
                            value={d.min}
                            onChange={(e) => set("min", e.target.value)}
                            suffix={qSym}
                            invalid={!!err("min", 1)}
                          />
                        </Field>
                        <Field
                          label="Maximum raise"
                          htmlFor="max"
                          error={err("max", 1)}
                          hint="Oversubscription is refunded pro-rata."
                        >
                          <Input
                            id="max"
                            inputMode="decimal"
                            autoComplete="off"
                            value={d.max}
                            onChange={(e) => set("max", e.target.value)}
                            suffix={qSym}
                            invalid={!!err("max", 1)}
                          />
                        </Field>
                        <Field
                          label="Liquidity share"
                          htmlFor="liq"
                          error={err("liquidity", 1)}
                          hint={`Share of net proceeds paired with new tokens at the raise price, owned by the treasury · ${formatBps(b.minLiquidityBps, { digits: 0 })} to ${formatBps(b.maxLiquidityBps, { digits: 0 })}`}
                        >
                          <Input
                            id="liq"
                            inputMode="decimal"
                            autoComplete="off"
                            value={d.liquidityPct}
                            onChange={(e) => set("liquidityPct", e.target.value)}
                            suffix="%"
                            invalid={!!err("liquidity", 1)}
                          />
                        </Field>
                        <div className="flex flex-col justify-end gap-1 rounded-[8px] border border-line bg-surface-2 p-4">
                          <p className="mono-xs text-fg-3 uppercase">Protocol fee</p>
                          <p className="body-sm text-fg">
                            {formatBps(factory.raiseFeeBps)} of the accepted amount, fixed at
                            creation
                          </p>
                        </div>
                      </div>
                    )}

                    {i === 2 && (
                      <div className="flex flex-col gap-6">
                        <Field
                          label="Operating budget per month"
                          htmlFor="budget"
                          error={err("budget", 2)}
                          hint="Streamed per second to the founder from launch. Everything beyond it needs a passed proposal."
                        >
                          <Input
                            id="budget"
                            inputMode="decimal"
                            autoComplete="off"
                            value={d.budget}
                            onChange={(e) => set("budget", e.target.value)}
                            suffix={qSym}
                            invalid={!!err("budget", 2)}
                          />
                        </Field>

                        <div className="flex flex-col gap-3">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="body-sm font-medium text-fg">Milestone tranches</p>
                            <p className="mono-xs text-fg-3">
                              share of launch treasury · each released by a PASS verdict
                            </p>
                          </div>
                          <ol className="grid border-t border-l border-line-strong sm:grid-cols-2 lg:grid-cols-4">
                            {d.tranches.map((t, ti) => (
                              <li
                                key={ti}
                                className="flex flex-col gap-2 border-r border-b border-line-strong bg-surface-2 p-3"
                              >
                                <div className="flex items-center justify-between">
                                  <label htmlFor={`tr-${ti}`} className="body-sm text-fg">
                                    Tranche {ti + 1}
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      set(
                                        "tranches",
                                        d.tranches.filter((_, j) => j !== ti),
                                      )
                                    }
                                    className="-m-2 rounded-full p-2 text-fg-3 hover:text-fg"
                                    aria-label={`Remove tranche ${ti + 1}`}
                                  >
                                    <X className="size-3.5" aria-hidden />
                                  </button>
                                </div>
                                <Input
                                  id={`tr-${ti}`}
                                  inputMode="decimal"
                                  autoComplete="off"
                                  value={t}
                                  onChange={(e) =>
                                    set(
                                      "tranches",
                                      d.tranches.map((x, j) => (j === ti ? e.target.value : x)),
                                    )
                                  }
                                  suffix="%"
                                  invalid={!!err(`tranche${ti}`, 2)}
                                />
                              </li>
                            ))}
                          </ol>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <Button
                              type="button"
                              variant="tertiary"
                              size="sm"
                              disabled={d.tranches.length >= b.maxTranches}
                              onClick={() => set("tranches", [...d.tranches, "10"])}
                            >
                              <Plus aria-hidden /> Add tranche
                            </Button>
                            <p
                              className={cn(
                                "mono-xs",
                                errors.tranches && showErrors[2] ? "text-fail" : "text-fg-3",
                              )}
                            >
                              {errors.tranches && showErrors[2]
                                ? `⚠ ${errors.tranches}`
                                : `${formatBps(v.trancheBps.reduce<number>((a, x) => a + (x ?? 0), 0))} gated · the rest funds the budget`}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 border-t border-line-strong pt-6">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="body-sm font-medium text-fg">
                              Founder performance package
                            </p>
                            <p className="mono-xs text-fg-3">
                              optional · minted only if the spot TWAP holds the multiple
                            </p>
                          </div>
                          {d.perf.map((p, pi) => (
                            <div
                              key={pi}
                              className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_auto]"
                            >
                              <Field
                                label={`Price multiple ${pi + 1}`}
                                htmlFor={`pm-${pi}`}
                                error={err(`perfm${pi}`, 2)}
                              >
                                <Input
                                  id={`pm-${pi}`}
                                  inputMode="decimal"
                                  autoComplete="off"
                                  value={p.multiple}
                                  onChange={(e) =>
                                    set(
                                      "perf",
                                      d.perf.map((x, j) =>
                                        j === pi ? { ...x, multiple: e.target.value } : x,
                                      ),
                                    )
                                  }
                                  suffix="×"
                                  invalid={!!err(`perfm${pi}`, 2)}
                                />
                              </Field>
                              <Field
                                label="Tokens minted"
                                htmlFor={`pa-${pi}`}
                                error={err(`perfa${pi}`, 2)}
                              >
                                <Input
                                  id={`pa-${pi}`}
                                  inputMode="decimal"
                                  autoComplete="off"
                                  value={p.amount}
                                  onChange={(e) =>
                                    set(
                                      "perf",
                                      d.perf.map((x, j) =>
                                        j === pi ? { ...x, amount: e.target.value } : x,
                                      ),
                                    )
                                  }
                                  suffix={d.symbol || "TOK"}
                                  invalid={!!err(`perfa${pi}`, 2)}
                                />
                              </Field>
                              <button
                                type="button"
                                onClick={() =>
                                  set(
                                    "perf",
                                    d.perf.filter((_, j) => j !== pi),
                                  )
                                }
                                className="mt-7 grid size-10 place-items-center rounded-full text-fg-3 hover:bg-surface-2 hover:text-fg"
                                aria-label={`Remove performance tranche ${pi + 1}`}
                              >
                                <X className="size-4" aria-hidden />
                              </button>
                            </div>
                          ))}
                          {d.perf.length > 0 && (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <DurationField
                                id="cliff"
                                label="Cliff after launch"
                                value={d.perfCliff}
                                unit={d.perfCliffUnit}
                                onValue={(x) => set("perfCliff", x)}
                                onUnit={(u) => set("perfCliffUnit", u)}
                                error={err("perfCliff", 2)}
                              />
                              <DurationField
                                id="pwin"
                                label="TWAP unlock window"
                                value={d.perfWindow}
                                unit={d.perfWindowUnit}
                                onValue={(x) => set("perfWindow", x)}
                                onUnit={(u) => set("perfWindowUnit", u)}
                                error={err("perfWindow", 2)}
                              />
                            </div>
                          )}
                          <div>
                            <Button
                              type="button"
                              variant="tertiary"
                              size="sm"
                              disabled={d.perf.length >= b.maxPerfTranches}
                              onClick={() =>
                                set("perf", [
                                  ...d.perf,
                                  { multiple: String(2 ** (d.perf.length + 1)), amount: "" },
                                ])
                              }
                            >
                              <Plus aria-hidden /> Add performance tranche
                            </Button>
                          </div>
                        </div>

                        <div className="border-t border-line-strong pt-6">
                          <button
                            type="button"
                            onClick={() => setShowGov((s) => !s)}
                            aria-expanded={showGov}
                            className="body-sm font-medium text-fg hover:text-accent"
                          >
                            {showGov ? "▾" : "▸"} Governance settings
                          </button>
                          <p className="mono-xs mt-1 text-fg-3">
                            Trading {formatDuration(Number(d.gov.duration) || 0)} after a{" "}
                            {formatDuration(Number(d.gov.warmup) || 0)} warm-up · bond {d.gov.bond}{" "}
                            {qSym} · only a passed UpdateConfig can change these later
                          </p>
                          {Object.keys(errors).some((k) => k.startsWith("gov.")) &&
                            showErrors[2] &&
                            !showGov && (
                              <p role="alert" className="caption mt-2 text-fail">
                                ⚠ Some governance settings are out of bounds
                              </p>
                            )}
                          {showGov && (
                            <div className="mt-4">
                              <ConfigEditor
                                cfg={d.gov}
                                setCfg={(c) => set("gov", c)}
                                bounds={b}
                                quoteSymbol={qSym}
                                errors={Object.fromEntries(
                                  Object.entries(errors)
                                    .filter(([k]) => k.startsWith("gov."))
                                    .map(([k, x]) => [k.slice(4), x]),
                                )}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {i === 3 && (
                      <MemoEditor
                        label="Raise Memo"
                        value={memo}
                        onChange={setMemo}
                        maxBytes={b.maxMemoBytes}
                        rows={18}
                      />
                    )}

                    {i === 4 && <Review v={v} factory={factory} qSym={qSym} />}

                    {i === 3 && errors.memo && showErrors[3] && (
                      <p role="alert" className="caption mt-2 text-fail">
                        ⚠ {errors.memo}
                      </p>
                    )}

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line-strong pt-5">
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={i === 0}
                        onClick={() => setStep(i - 1)}
                      >
                        Back
                      </Button>
                      {i < STEPS.length - 1 ? (
                        <Button type="button" variant="primary" onClick={next}>
                          Continue
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="accent"
                          size="lg"
                          loading={busy}
                          disabled={!v.params || !!errors.memo || factory.creationPaused}
                          onClick={publish}
                        >
                          Publish raise
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {IS_TESTNET && (
          <p className="mono-xs mt-4 text-fg-3">
            USDC raises use Circle testnet USDC.{" "}
            <a
              href={FAUCETS.usdc}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:text-accent-hover"
            >
              Get USDC ↗
            </a>{" "}
            ·{" "}
            {quotes.length > 1 && <>mUSDC raises use a test token minted from the raise page · </>}
            <a
              href={FAUCETS.mon}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:text-accent-hover"
            >
              Get MON for gas ↗
            </a>
          </p>
        )}
      </Section>
    </>
  );
}

function DurationField({
  id,
  label,
  value,
  unit,
  onValue,
  onUnit,
  error,
}: {
  id: string;
  label: string;
  value: string;
  unit: Unit;
  onValue: (v: string) => void;
  onUnit: (u: Unit) => void;
  error?: string;
}) {
  return (
    <Field label={label} htmlFor={id} error={error}>
      <div className="flex gap-2">
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onValue(e.target.value)}
          invalid={!!error}
        />
        <div className="w-[200px] shrink-0">
          <Segmented
            label={`${label} unit`}
            value={unit}
            onChange={onUnit}
            options={[
              { value: "min", label: "min" },
              { value: "hour", label: "hrs" },
              { value: "day", label: "days" },
            ]}
          />
        </div>
      </div>
    </Field>
  );
}

function Review({
  v,
  factory,
  qSym,
}: {
  v: ReturnType<typeof validate>;
  factory: FactoryState;
  qSym: string;
}) {
  if (!v.params) {
    return (
      <p className="body-sm text-warning">
        ⚠ Some earlier steps still need attention. Open them to see what to fix.
      </p>
    );
  }
  const p = v.params;
  const feeBps = /^0x0{40}$/i.test(factory.feeRecipient) ? 0 : factory.raiseFeeBps;
  const atMin = launchAt(p.minRaise, p.price, p.maxRaise, p.liquidityBps, feeBps, p.trancheBps);
  const atMax = launchAt(p.maxRaise, p.price, p.maxRaise, p.liquidityBps, feeBps, p.trancheBps);
  const sym = p.symbol;
  const rows: [string, (x: typeof atMin) => string][] = [
    ["Accepted", (x) => formatUsd(x.accepted)],
    ["Protocol fee", (x) => formatUsd(x.fee)],
    ["Tokens to backers", (x) => formatToken(x.contributorTokens, 18, sym)],
    [
      "Liquidity seeded",
      (x) => `${formatUsd(x.liquidityQuote)} + ${formatToken(x.liquidityTokens, 18)}`,
    ],
    ["Treasury", (x) => formatUsd(x.treasury)],
    ["Supply at launch", (x) => formatToken(x.supply, 18)],
    ["FDV", (x) => formatUsd(x.fdv, 6, { compact: true })],
    ...p.trancheBps.map(
      (bp, i) =>
        [
          `Tranche ${i + 1} (${formatBps(bp, { digits: 0 })})`,
          (x: typeof atMin) => formatUsd(x.tranches[i] ?? 0n),
        ] as [string, (x: typeof atMin) => string],
    ),
  ];
  const monthsMin =
    p.budgetPerMonth > 0n
      ? Number(atMin.treasury - atMin.tranches.reduce((a, t) => a + t, 0n)) /
        Number(p.budgetPerMonth)
      : Infinity;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel className="bg-surface-2 p-5">
          <p className="mono-xs text-fg-3 uppercase">Token</p>
          <p className="heading-sm mt-1">
            {p.name} · ${sym}
          </p>
          <p className="body-sm mt-2 text-fg-2">
            {formatTokenPrice(p.price)} per token in {qSym} · {formatDuration(p.windowSec)} window ·
            founder {p.founder.slice(0, 6)}…{p.founder.slice(-4)}
          </p>
        </Panel>
        <Panel className="bg-surface-2 p-5">
          <p className="mono-xs text-fg-3 uppercase">Governance</p>
          <p className="body-sm mt-2 text-fg-2">
            {formatDuration(p.gov.warmup)} warm-up, {formatDuration(p.gov.duration)} TWAP window,{" "}
            {formatBps(p.gov.proposalLiquidityBps, { digits: 0 })} liquidity per market. Thresholds{" "}
            {formatBps(p.gov.thetaTrancheBps, { signed: true })} /{" "}
            {formatBps(p.gov.thetaTeamBps, { signed: true })} /{" "}
            {formatBps(p.gov.thetaCommunityBps, { signed: true })} · bond {formatUsd(p.gov.bond)}
          </p>
        </Panel>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px]">
          <caption className="sr-only">Launch preview at the minimum and maximum raise</caption>
          <thead>
            <tr className="mono-xs text-fg-3 uppercase">
              <th className="py-2 text-left font-normal">If the raise ends at</th>
              <th className="py-2 text-right font-normal">Minimum</th>
              <th className="py-2 text-right font-normal">Maximum</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, f]) => (
              <tr key={label} className="border-t border-line-strong">
                <td className="py-2.5 mono-xs text-fg-3 uppercase">{label}</td>
                <td className="py-2.5 text-right body-sm tabular">{f(atMin)}</td>
                <td className="py-2.5 text-right body-sm tabular">{f(atMax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <KV
        rows={[
          ["Budget", `${formatUsd(p.budgetPerMonth)} / month`],
          [
            "Runway outside tranches at min",
            Number.isFinite(monthsMin) ? `${monthsMin.toFixed(1)} months` : "No budget",
          ],
          [
            "Performance package",
            p.perf.length
              ? p.perf.map((x) => `${(x.multipleX100 / 100).toFixed(1)}×`).join(" · ")
              : "None",
          ],
          ["Below minimum", "Every backer refunded in full"],
        ]}
      />
      {Number.isFinite(monthsMin) && monthsMin < 3 && (
        <p className="mono-xs text-warning">
          ⚠ At the minimum, budget plus tranches leave under 3 months of runway. Budget and tranches
          share one treasury.
        </p>
      )}
      <p className="mono-xs text-fg-3">
        Publishing opens the raise immediately. Its terms are immutable: nobody, Moneta included,
        can change them afterwards.
      </p>
    </div>
  );
}
