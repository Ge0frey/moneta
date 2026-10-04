"use client";

import { formatBps } from "@moneta/sdk";
import { create } from "zustand";
import { cn } from "@/lib/cn";

const OPTIONS = [50, 100, 300, 500] as const;
const KEY = "moneta:slippageBps";

function initial(): number {
  try {
    const v = Number(globalThis.localStorage?.getItem(KEY));
    return OPTIONS.includes(v as (typeof OPTIONS)[number]) ? v : 100;
  } catch {
    return 100;
  }
}

/** Per-viewer slippage tolerance (a convenience, so browser storage is fine; defaults to 1%). */
export const useSlippage = create<{ bps: number; set: (bps: number) => void }>((set) => ({
  bps: 100,
  set: (bps) => {
    try {
      globalThis.localStorage?.setItem(KEY, String(bps));
    } catch {
      /* storage unavailable */
    }
    set({ bps });
  },
}));

if (typeof window !== "undefined") useSlippage.setState({ bps: initial() });

export function SlippageControl() {
  const { bps, set } = useSlippage();
  return (
    <fieldset className="flex items-center justify-between gap-3">
      <legend className="sr-only">Slippage tolerance</legend>
      <span className="mono-xs text-fg-3 uppercase" aria-hidden>
        Slippage
      </span>
      <div className="flex gap-1">
        {OPTIONS.map((o) => (
          <label
            key={o}
            className={cn(
              "relative grid h-10 cursor-pointer place-items-center px-0.5",
              "has-[:focus-visible]:rounded-full has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
            )}
          >
            <input
              type="radio"
              name="slippage"
              className="sr-only"
              checked={bps === o}
              onChange={() => set(o)}
              aria-label={`${formatBps(o)} slippage`}
            />
            <span
              className={cn(
                "inline-flex h-7 items-center rounded-full border px-2.5 mono-xs transition-colors duration-150",
                bps === o
                  ? "border-white bg-white text-fg-inverse"
                  : "border-line bg-surface-2 text-fg-2 hover:text-fg",
              )}
            >
              {formatBps(o)}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
