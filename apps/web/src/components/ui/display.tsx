"use client";

import { explorerAddressUrl, formatCountdown, formatUsd, shortAddress } from "@moneta/sdk";
import { Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { keccak256, toBytes } from "viem";
import { cn } from "@/lib/cn";
import { CHAIN_ID } from "@/lib/env";
import { useChainNow } from "@/lib/hooks/chain";

export { PageHeader } from "./page-header";

/** Card/panel surface. */
export function Panel({
  children,
  className,
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={cn("rounded-[16px] border border-line-subtle bg-surface-1 p-6", className)}>
      {(title || action) && (
        <header className="mb-5 flex items-center justify-between gap-3">
          {title && <h2 className="heading-sm">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** Raise progress: white fill, tick at the minimum, warning overflow when oversubscribed. */
export function RaiseProgress({
  total,
  min,
  max,
  decimals = 6,
}: {
  total: bigint;
  min: bigint;
  max: bigint;
  decimals?: number;
}) {
  const pct = (v: bigint) => Math.min(100, Number((v * 10_000n) / (max || 1n)) / 100);
  const over = total > max;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="figure-lg">{formatUsd(total, decimals)}</span>
        <span className="mono-xs text-fg-3">{pct(total).toFixed(0)}% of max</span>
      </div>
      <div
        className="relative h-1 rounded-full bg-surface-3"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={Number(max)}
        aria-valuenow={Number(total)}
        aria-label="Raise progress"
      >
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full", over ? "bg-warning" : "bg-white")}
          style={{ width: `${pct(total)}%` }}
        />
        <span
          className="absolute -top-1 h-3 w-px bg-tick"
          style={{ left: `${pct(min)}%` }}
          aria-hidden
        />
      </div>
      <div className="mt-2 flex justify-between mono-xs text-fg-3">
        <span>Min {formatUsd(min, decimals)}</span>
        <span>Max {formatUsd(max, decimals)}</span>
      </div>
      {over && (
        <p className="mono-xs mt-2 text-warning">Oversubscribed · excess refunded pro-rata</p>
      )}
    </div>
  );
}

/** Countdown to a chain timestamp — uses chain time, not the user's clock. */
export function Countdown({
  to,
  label,
  done = "Ended",
}: {
  to: number;
  label: string;
  done?: string;
}) {
  const now = useChainNow();
  if (now === undefined) return <span className="figure-lg text-fg-3">--:--</span>;
  const left = to - now;
  return (
    <div>
      <p className="figure-lg" aria-live="off">
        {left > 0 ? formatCountdown(left) : done}
      </p>
      <p className="mono-xs mt-1 text-fg-3">{left > 0 ? label : "chain time"}</p>
    </div>
  );
}

export function AddressChip({ address, label }: { address: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const url = explorerAddressUrl(CHAIN_ID, address);
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap mono-xs text-fg-2">
      {label && <span className="text-fg-3">{label}</span>}
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(address);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className="inline-flex items-center gap-1 rounded-[4px] px-1 py-0.5 hover:bg-surface-2 hover:text-fg"
        aria-label={`Copy ${address}`}
      >
        {shortAddress(address)}
        {copied ? (
          <Check className="size-3 text-pass" aria-hidden />
        ) : (
          <Copy className="size-3" aria-hidden />
        )}
      </button>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="hover:text-fg"
          aria-label="Open in explorer"
        >
          ↗
        </a>
      )}
    </span>
  );
}

/** Key/value rows (terms tables). */
export function KV({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="divide-y divide-line-strong border-y border-line-strong">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex items-baseline justify-between gap-4 py-3">
          <dt className="mono-xs text-fg-3 uppercase">{k}</dt>
          <dd className="body-sm tabular text-right text-fg">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Phase timeline — e.g. Warm-up → Trading → Verdict → Executed. */
export function PhaseTimeline({
  phases,
  current,
}: {
  phases: { label: string; sub?: string }[];
  current: number;
}) {
  return (
    <ol
      className="grid border-t border-l border-line-strong"
      style={{ gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))` }}
    >
      {phases.map((p, i) => (
        <li key={p.label} className="border-r border-b border-line-strong">
          <p className={cn("body-sm px-3 py-2.5", i <= current ? "text-fg" : "text-fg-3")}>
            {p.label}
          </p>
          <div className="relative h-px bg-line-strong">
            <span
              aria-hidden
              className={cn(
                "absolute top-1/2 left-0 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
                i === current
                  ? "border-2 border-white bg-canvas"
                  : i < current
                    ? "bg-white"
                    : "bg-surface-3",
              )}
            />
          </div>
          <p className="mono-xs min-h-[40px] bg-surface-1 px-3 py-2.5 text-fg-3">{p.sub ?? ""}</p>
        </li>
      ))}
    </ol>
  );
}

/**
 * Memo Markdown is user-written content on our domain:
 * - headings shift down two levels: the page's <h1> is the raise/proposal name and the panel title is an
 *   <h2>, so a memo's "# Name" must not become a second <h1>;
 * - links are marked user-generated (`ugc nofollow`) and open in a new tab, so a memo can't borrow the
 *   site's reputation for its links (react-markdown already strips javascript: URLs).
 */
const MEMO_COMPONENTS: Components = {
  h1: ({ children }) => <h3 className="md-h1">{children}</h3>,
  h2: ({ children }) => <h4 className="md-h2">{children}</h4>,
  h3: ({ children }) => <h5 className="md-h3">{children}</h5>,
  h4: ({ children }) => <h6 className="md-h3">{children}</h6>,
  h5: ({ children }) => <h6 className="md-h3">{children}</h6>,
  h6: ({ children }) => <h6 className="md-h3">{children}</h6>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="ugc nofollow noopener noreferrer">
      {children}
    </a>
  ),
};

/** Markdown memo rendered safely (no raw HTML) and verified against its on-chain hash. */
export function Memo({ text, hash }: { text: string; hash?: string }) {
  const ok = hash ? keccak256(toBytes(text)).toLowerCase() === hash.toLowerCase() : undefined;
  return (
    <div>
      {ok !== undefined && (
        <p
          className={cn(
            "mono-xs mb-4 inline-flex items-center gap-1.5",
            ok ? "text-fg-3" : "text-warning",
          )}
        >
          {ok ? <Check className="size-3 text-pass" aria-hidden /> : "⚠"}
          {ok ? "Memo matches its on-chain hash" : "Memo text does not match the on-chain hash"}
        </p>
      )}
      <div className="memo">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MEMO_COMPONENTS}>
          {text}
        </ReactMarkdown>
      </div>
    </div>
  );
}
