import Link from "next/link";
import type { ReactNode } from "react";
import { AsciiField } from "@/components/art/AsciiField";
import { Button } from "@/components/ui/button";
import { BentoCard } from "@/components/ui/cards";
import { Eyebrow } from "@/components/ui/pills";

/* ── 3. Feature card: Decision Markets ─────────────────────────────────────── */
export function DecisionMarketsFeature() {
  return (
    <div className="grid gap-6 rounded-[24px] border border-line-subtle bg-surface-1 p-6 md:grid-cols-2">
      <div className="relative aspect-square overflow-hidden rounded-[4px] bg-canvas">
        <AsciiField
          motif="fork"
          className="absolute inset-0 size-full"
          cell={9}
          zoom={0.3}
          speed={0.06}
          tilt={-0.12}
          density={0.026}
        />
      </div>
      <div className="flex flex-col justify-end gap-5 md:py-4">
        <h2 className="heading-xl">Decision Markets</h2>
        <p className="body max-w-[46ch] text-fg">
          Every proposal opens two markets: the token if it passes, and the token if it fails. A
          lagging TWAP decides. PASS executes on-chain; FAIL leaves the capital exactly where it is.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/docs#verdicts">How Verdicts Work</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/docs">Read the Idea</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── 4. Bento ──────────────────────────────────────────────────────────────── */
export function Bento() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="grid gap-4">
        <BentoCard
          title="Permissionless By Design."
          body="Anyone with a project and a community can open a raise. Backers decide if it launches."
        />
        <BentoCard
          title="Unruggable Treasuries."
          body="Founders get a streamed budget. Everything else needs a PASS verdict — and holders can always vote to redeem at NAV."
        />
      </div>
      <BentoCard
        className="md:min-h-[352px]"
        title="Shared Liquidity, Deeper Markets."
        body="Treasury-owned liquidity flows into every decision market at the spot price, then returns after the verdict."
      />
    </div>
  );
}

/* ── 5. How Moneta Works (diagram card) ────────────────────────────────────── */
function Node({ title, sub, className }: { title: string; sub: string; className?: string }) {
  return (
    <div className={`rounded-[4px] border border-line bg-surface-1 px-3.5 py-3 ${className ?? ""}`}>
      <p className="body-sm text-fg">{title}</p>
      <p className="mono-xs mt-1 text-fg-3">{sub}</p>
    </div>
  );
}

function Group({
  label,
  title,
  sub,
  children,
}: {
  label: string;
  title: string;
  sub: string;
  children: ReactNode;
}) {
  return (
    <div className="relative rounded-[8px] border border-line bg-canvas p-4 pt-6">
      <span className="absolute -top-2.5 left-4 rounded-[4px] border border-line bg-surface-2 px-2 mono-xs text-fg-2">
        {label}
      </span>
      <p className="body-sm font-medium">{title}</p>
      <p className="mono-xs mb-3 text-fg-3">{sub}</p>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}

function Arrow({ label, vertical }: { label: string; vertical?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center gap-1 mono-xs text-fg-3 ${vertical ? "flex-col py-1" : "flex-col px-1"}`}
    >
      <span>{label}</span>
      <span aria-hidden>{vertical ? "↓" : "→"}</span>
    </div>
  );
}

export function HowItWorks() {
  return (
    <div className="flex flex-col gap-6">
      <Eyebrow className="w-fit">Protocol</Eyebrow>
      <h2 className="heading-xl">How Moneta Works</h2>
      <p className="body max-w-[52ch] text-fg">
        A raise escrows contributions until its window closes. Success launches a token, seeds
        liquidity and forms a treasury the founder doesn&apos;t control. From then on, decision
        markets decide how capital moves.
      </p>
      <figure
        className="mt-4 rounded-[24px] border border-line bg-canvas p-5 md:p-10"
        aria-label="Moneta lifecycle: backers fund a raise, which launches a treasury governed by PASS and FAIL decision markets"
      >
        <div className="grid items-center gap-3 lg:grid-cols-[150px_auto_1fr_auto_1fr]">
          <div className="grid gap-2">
            <Node title="Founder" sub="Raise Memo · milestones" />
            <Node title="Backers" sub="USDC · permit" />
          </div>
          <Arrow label="contribute" />
          <Group label="Raise" title="Escrow" sub="min / max · pro-rata refunds">
            <Node title="Finalize" sub="token · liquidity · treasury" />
            <Node title="Refund" sub="below minimum → 100% back" />
          </Group>
          <Arrow label="launch" />
          <Group label="Treasury" title="Market-governed" sub="no admin · no multisig">
            <Node title="Budget stream" sub="per second · founder" />
            <Node title="Tranches" sub="released only on PASS" />
            <Node title="Redemption" sub="exit at NAV" />
          </Group>
        </div>
        <div className="mt-3 lg:ml-[calc(150px+4.5rem)]">
          <Arrow label="split · trade · TWAP" vertical />
          <Group
            label="Decision markets"
            title="Every proposal"
            sub="conditional tokens · lagging TWAP · one verdict"
          >
            <div className="grid gap-2 sm:grid-cols-3">
              <Node title="▲ PASS pool" sub="the token if it passes" className="border-pass/40" />
              <Node title="▼ FAIL pool" sub="the token if it fails" className="border-fail/40" />
              <Node title="Verdict" sub="PASS if TWAP(pass) ≥ TWAP(fail) × (1 + threshold)" />
            </div>
          </Group>
        </div>
        <figcaption className="mt-6 rounded-[4px] border border-line bg-surface-1 px-4 py-3 text-center">
          <span className="body-sm">Monad</span>
          <span className="mono-xs ml-2 text-fg-3">
            300 ms blocks · ~600 ms finality · settlement for every verdict
          </span>
        </figcaption>
      </figure>
    </div>
  );
}

/* ── 6. Built on Monad (marquee; "Built with" — never "Backed by") ─────────── */
const BUILT_WITH = [
  "Monad",
  "Circle USDC",
  "Envio HyperIndex",
  "Safe",
  "Foundry",
  "OpenZeppelin",
  "viem",
  "wagmi",
];

function MarqueeRow({ reverse }: { reverse?: boolean }) {
  const items = [...BUILT_WITH, ...BUILT_WITH];
  return (
    <div className="flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
      <ul
        className={`flex shrink-0 gap-12 py-4 pr-12 ${reverse ? "animate-marquee-rev" : "animate-marquee"} hover:[animation-play-state:paused]`}
      >
        {items.map((n, i) => (
          <li
            key={`${n}-${i}`}
            className="text-[20px] font-medium tracking-[-0.01em] whitespace-nowrap text-fg-2"
            aria-hidden={i >= BUILT_WITH.length}
          >
            {n}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BuiltWith() {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2">
      <h2 className="heading-xl">Built On Monad</h2>
      <div className="border-y border-line-grid lg:-mr-[calc((100vw-1000px)/2)]">
        <span className="sr-only">Built with: {BUILT_WITH.join(", ")}</span>
        <MarqueeRow />
        <MarqueeRow reverse />
      </div>
    </div>
  );
}

/* ── 7. Roadmap timeline ───────────────────────────────────────────────────── */
const ROADMAP = [
  {
    when: "Now",
    title: "Futarchy raises",
    body: "Permissionless raises, milestone tranches, redemption.",
  },
  {
    when: "Next",
    title: "Futarchy-as-a-service",
    body: "Existing Monad tokens adopt Moneta treasuries.",
  },
  {
    when: "Later",
    title: "The Moneta Fund",
    body: "Markets decide which projects get funded at all.",
  },
  { when: "Later", title: "Instruments", body: "Revenue share, convertibles, secondary markets." },
];

export function Roadmap() {
  return (
    <div className="flex flex-col gap-10">
      <h2 className="heading-xl">Roadmap</h2>
      <ol className="grid border-t border-l border-line-strong sm:grid-cols-2 lg:grid-cols-4">
        {ROADMAP.map((r, i) => (
          <li key={r.title} className="relative border-r border-b border-line-strong">
            <p className="body-sm px-4 py-3">{r.title}</p>
            <div className="relative h-px bg-line-strong">
              <span
                aria-hidden
                className={`absolute top-1/2 left-0 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${i === 0 ? "border-2 border-white bg-canvas" : "bg-surface-3"}`}
              />
            </div>
            <div className="min-h-[96px] bg-surface-1 px-4 py-4">
              <p className="body-sm text-fg">{r.when}</p>
              <p className="body-sm mt-1 text-fg-3">{r.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ── 9. Use Moneta (fused grid) ────────────────────────────────────────────── */
const USE = [
  {
    title: "Create a Raise",
    body: "Publish a memo, set milestones, go live.",
    cta: "Start",
    href: "/create",
  },
  {
    title: "Back a Project",
    body: "Same price for everyone. Refunds if it misses.",
    cta: "Explore",
    href: "/explore",
  },
  {
    title: "Trade a Verdict",
    body: "Price the PASS and FAIL worlds.",
    cta: "Live markets",
    href: "/explore?status=verdict",
  },
  {
    title: "Read the Docs",
    body: "Mechanism, math and security model.",
    cta: "Docs",
    href: "/docs",
  },
];

export function UseMoneta() {
  return (
    <div className="flex flex-col gap-10">
      <h2 className="heading-xl">Use Moneta</h2>
      <div className="grid border-t border-l border-line-strong sm:grid-cols-2 lg:grid-cols-4">
        {USE.map((u) => (
          <Link
            key={u.title}
            href={u.href}
            className="group flex flex-col border-r border-b border-line-strong bg-canvas"
          >
            <div className="flex h-[216px] flex-col justify-between p-6">
              <h3 className="heading-md">{u.title}</h3>
              <p className="mono-sm max-w-[24ch] text-fg">{u.body}</p>
            </div>
            <span className="body-sm flex h-12 items-center border-t border-line-strong bg-surface-1 px-6 text-fg-2 transition-colors group-hover:text-fg">
              {u.cta} ›
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── 10. CTA card (dither + halo) ──────────────────────────────────────────── */
export function CtaCard() {
  return (
    <div className="rounded-[24px] border border-line-subtle bg-surface-1 p-6 md:p-8">
      <p className="mono-sm text-fg">Accountable capital on Monad</p>
      <p className="heading-lg mt-6 max-w-[34ch]">
        Raise in minutes. Release capital only when the market agrees. Exit at NAV if it
        doesn&apos;t.
      </p>
      <div className="dither mt-10 grid h-[260px] place-items-center overflow-hidden rounded-[8px] [--glow-x:50%] [--glow-y:110%]">
        <div className="rounded-full bg-white/[0.28] p-3 backdrop-blur-sm">
          <Button asChild size="lg">
            <Link href="/create">Launch a Raise</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── 13. Closing card ──────────────────────────────────────────────────────── */
export function ClosingCard() {
  return (
    <div className="dither relative overflow-hidden rounded-[24px] border border-line-subtle p-8 md:p-16">
      <h2 className="display-lg">Build With Us</h2>
      <p className="body mt-6 max-w-[56ch] text-fg">
        Moneta is open source and permissionless. Fork it, integrate it, or launch the next Monad
        project on it.
      </p>
      <div className="mt-10 flex flex-wrap items-center gap-6">
        <Link href="/docs" className="body-sm text-fg underline-offset-4 hover:underline">
          Docs
        </Link>
        <Link
          href="/docs#architecture"
          className="body-sm text-fg underline-offset-4 hover:underline"
        >
          Architecture
        </Link>
        <Link href="/status" className="body-sm text-fg underline-offset-4 hover:underline">
          Protocol status
        </Link>
      </div>
    </div>
  );
}
