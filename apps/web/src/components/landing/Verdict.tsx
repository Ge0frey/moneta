"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { SectionHead } from "./SectionHead";

/* ── A simulated proposal, run on the protocol's rules ──────────────────────────────────────────
   Spot trades until the split (25%); two pools then open at the same price. Each pool's lagging
   observation follows its spot by at most STEP per tick; the verdict compares the observations'
   averages over the trading window (50% → 100%). Deterministic, so the figure never changes. */
const N = 240;
const SPLIT = N * 0.25;
const WINDOW = N * 0.5;
const STEP = 0.0011;
const THRESHOLD = 0.03;

function simulate(seed: number) {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());
  const ease = (x: number) => 1 - Math.pow(1 - x, 2.2);

  const spot: number[] = [];
  let p = 1;
  for (let i = 0; i <= SPLIT; i++) {
    spot.push(p);
    p += (1 - p) * 0.1 + gauss() * 0.0035;
  }
  const pass: number[] = [],
    fail: number[] = [],
    passObs: number[] = [],
    failObs: number[] = [];
  let ps = p,
    fs = p,
    po = p,
    fo = p;
  for (let i = SPLIT; i < N; i++) {
    const t = ease((i - SPLIT) / (N - 1 - SPLIT));
    ps += (1 + 0.085 * t - ps) * 0.12 + gauss() * 0.0055;
    fs += (1 - 0.018 * t - fs) * 0.12 + gauss() * 0.0055;
    po += Math.max(-STEP, Math.min(STEP, ps - po));
    fo += Math.max(-STEP, Math.min(STEP, fs - fo));
    pass.push(ps);
    fail.push(fs);
    passObs.push(po);
    failObs.push(fo);
  }
  const twap = (xs: number[]) => {
    const w = xs.slice(WINDOW - SPLIT);
    return w.reduce((s, x) => s + x, 0) / w.length;
  };
  return { spot, pass, fail, passObs, failObs, twapPass: twap(passObs), twapFail: twap(failObs) };
}

function useInView<T extends Element>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen] as const;
}

function useWidth<T extends Element>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e?.contentRect.width ?? 0)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const fmt = (v: number) => v.toFixed(3);

function VerdictPlot() {
  const sim = useMemo(() => simulate(11), []);
  const [box, W] = useWidth<HTMLDivElement>();
  const [view, seen] = useInView<HTMLElement>();
  const [H, setH] = useState(300);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setH(mq.matches ? 320 : 240);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const all = [...sim.spot, ...sim.pass, ...sim.fail];
  const lo = Math.min(...all) - 0.006;
  const hi = Math.max(...all) + 0.006;
  const x = (i: number) => (i / (N - 1)) * W;
  const y = (v: number) => 14 + ((hi - v) / (hi - lo)) * (H - 28);
  const path = (xs: number[], from = 0) =>
    xs.map((v, i) => `${i ? "L" : "M"}${x(from + i).toFixed(1)} ${y(v).toFixed(1)}`).join("");

  const delta = sim.twapPass / sim.twapFail - 1;
  const yPass = y(sim.twapPass);
  const yFail = y(sim.twapFail);

  return (
    <figure ref={view} className="flex flex-col gap-4">
      <div className="label-mono flex flex-wrap items-center gap-x-6 gap-y-2 text-fg-3">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-[1.5px] w-5 bg-fg" />▲ Pass · lagging price
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="h-[1.5px] w-5 bg-[repeating-linear-gradient(90deg,rgb(255_255_255/0.55)_0_5px,transparent_5px_9px)]"
          />
          ▼ Fail · lagging price
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-px w-5 bg-white/30" />
          Spot
        </span>
      </div>

      <div ref={box} className="relative" style={{ height: H }}>
        {/* trading window: the stretch that counts */}
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 left-1/2 bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.035)_0_1px,transparent_1px_7px)]"
        >
          <span className="label-mono absolute top-0 left-3 text-fg-muted">TWAP window</span>
        </div>
        <div
          className="absolute inset-0 transition-[clip-path] duration-[2600ms] ease-[cubic-bezier(.45,0,.25,1)]"
          style={{ clipPath: seen ? "inset(0 0 0 0)" : "inset(0 100% 0 0)" }}
        >
          {W > 0 && (
            <svg
              width={W}
              height={H}
              fill="none"
              aria-hidden
              className="absolute inset-0 overflow-visible"
            >
              <g strokeWidth={1}>
                <line
                  x1={x(SPLIT)}
                  x2={x(SPLIT)}
                  y1={0}
                  y2={H}
                  className="stroke-white/15"
                  strokeDasharray="2 4"
                />
                <line
                  x1={x(WINDOW)}
                  x2={x(WINDOW)}
                  y1={0}
                  y2={H}
                  className="stroke-white/15"
                  strokeDasharray="2 4"
                />
                <path d={path(sim.spot)} className="stroke-white/60" />
                <path d={path(sim.fail, SPLIT)} className="stroke-white/15" />
                <path d={path(sim.pass, SPLIT)} className="stroke-white/30" />
                <line
                  x1={x(WINDOW)}
                  x2={W}
                  y1={yPass}
                  y2={yPass}
                  className="stroke-white/40"
                  strokeDasharray="1 3"
                />
                <line
                  x1={x(WINDOW)}
                  x2={W}
                  y1={yFail}
                  y2={yFail}
                  className="stroke-white/40"
                  strokeDasharray="1 3"
                />
              </g>
              <path
                d={path(sim.failObs, SPLIT)}
                strokeWidth={1.5}
                strokeDasharray="5 4"
                className="stroke-white/55"
              />
              <path d={path(sim.passObs, SPLIT)} strokeWidth={1.5} className="stroke-white" />
              <circle
                cx={x(SPLIT)}
                cy={y(sim.spot[SPLIT]!)}
                r={3.5}
                strokeWidth={1.25}
                className="fill-canvas stroke-white"
              />
              <path
                d={`M${W - 0.5} ${yPass}V${yFail}M${W - 6} ${yPass}h6M${W - 6} ${yFail}h6`}
                strokeWidth={1}
                className="stroke-white/70"
              />
            </svg>
          )}
          {/* the reveal edge: a scan line that plots the market as it goes */}
          <span
            aria-hidden
            className={cn(
              "absolute inset-y-0 w-px bg-white/50 transition-[left,opacity] duration-[2600ms] ease-[cubic-bezier(.45,0,.25,1)]",
              seen ? "left-full opacity-0" : "left-0 opacity-100",
            )}
          />
        </div>

        {W > 0 && (
          <div
            className={cn(
              "transition-opacity delay-[2200ms] duration-700",
              seen ? "opacity-100" : "opacity-0",
            )}
          >
            <p
              className="mono-xs absolute right-3 bg-canvas px-1.5 py-0.5 text-fg tabular"
              style={{ top: yPass - 24 }}
            >
              ▲ PASS {fmt(sim.twapPass)}
            </p>
            <p
              className="mono-xs absolute right-3 bg-canvas px-1.5 py-0.5 text-fg-2 tabular"
              style={{ top: yFail + 6 }}
            >
              ▼ FAIL {fmt(sim.twapFail)}
            </p>
            <div
              className="absolute right-3 hidden -translate-y-1/2 bg-canvas/85 px-1.5 py-1 text-right sm:block"
              style={{ top: (yPass + yFail) / 2 }}
            >
              <p className="label-mono text-fg-3">Verdict</p>
              <p className="figure-lg mt-1">PASS</p>
              <p className="mono-xs mt-1 text-fg-3 tabular">
                +{(delta * 100).toFixed(1)}% ≥ {(THRESHOLD * 100).toFixed(0)}% threshold
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="relative grid grid-cols-4 border-t border-line-strong pt-3">
        {[
          ["Proposal", "spot trades"],
          ["Split", "two pools open"],
          ["Window", "TWAPs accrue"],
          ["Verdict", "PASS executes"],
        ].map(([t, sub], i) => (
          <div key={t} className={cn("min-w-0", i === 3 && "text-right", i > 0 && i < 3 && "pl-2")}>
            <p className="label-mono text-fg">{t}</p>
            <p className="mono-xs mt-1 hidden text-fg-3 sm:block">{sub}</p>
          </div>
        ))}
      </div>
      <p
        aria-hidden
        className={cn(
          "mono-xs text-fg-3 transition-opacity delay-[2200ms] duration-700 tabular sm:hidden",
          seen ? "opacity-100" : "opacity-0",
        )}
      >
        <span className="text-fg">Verdict · PASS</span> · +{(delta * 100).toFixed(1)}% ≥{" "}
        {(THRESHOLD * 100).toFixed(0)}% threshold
      </p>
      <figcaption className="sr-only">
        A simulated proposal. The token trades at one spot price until the split, when PASS and FAIL
        pools open at the same price. Over the trading window the PASS pool&apos;s lagging price
        averages {fmt(sim.twapPass)} and the FAIL pool&apos;s {fmt(sim.twapFail)}, a difference of{" "}
        {(delta * 100).toFixed(1)}%, above the {(THRESHOLD * 100).toFixed(0)}% threshold, so the
        proposal passes.
      </figcaption>
    </figure>
  );
}

/** III. Decision markets — a proposal plotted from split to verdict. */
export function Verdict() {
  return (
    <div className="flex flex-col gap-16">
      <SectionHead n="III" label="Decision markets" title="Two markets. One verdict.">
        <p className="body-lg max-w-[54ch] text-fg-2">
          Every proposal opens two markets: the token if it passes, and the token if it fails. Each
          keeps a lagging price that can only move so fast, so a last-second pump barely registers.
          PASS executes on-chain. FAIL leaves the capital exactly where it is.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/docs#verdicts">How Verdicts Work</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/explore?status=verdict">Live Markets</Link>
          </Button>
        </div>
      </SectionHead>
      <VerdictPlot />
    </div>
  );
}
