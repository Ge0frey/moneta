import Link from "next/link";
import { LiveDot } from "@/components/ui/pills";
import { cn } from "@/lib/cn";
import { SectionHead } from "./SectionHead";

/* ── IV. Roadmap: one row per phase, read across the frame ──────────────────── */
const ROADMAP = [
  {
    n: "I",
    when: "Now",
    title: "Futarchy raises",
    body: "Permissionless raises, milestone tranches, redemption.",
  },
  {
    n: "II",
    when: "Next",
    title: "Futarchy-as-a-service",
    body: "Existing Monad tokens adopt Moneta treasuries.",
  },
  {
    n: "III",
    when: "Later",
    title: "The Moneta Fund",
    body: "Markets decide which projects get funded at all.",
  },
  {
    n: "IV",
    when: "Later",
    title: "Instruments",
    body: "Revenue share, convertibles, secondary markets.",
  },
];

export function Roadmap() {
  return (
    <div className="flex flex-col gap-16">
      <SectionHead n="IV" label="Roadmap" title="Where Moneta goes next." />
      <ol className="border-t border-line">
        {ROADMAP.map((r, i) => {
          const now = i === 0;
          return (
            <li
              key={r.title}
              className="grid grid-cols-[3.5rem_1fr] gap-y-2 border-b border-line py-6 lg:grid-cols-4"
            >
              <p className="label-mono flex items-center gap-3 pt-1 lg:pt-1.5">
                <span className={cn("w-7", now ? "text-fg" : "text-fg-3")}>{r.n}</span>
                <span className="hidden items-center gap-2 text-fg-3 lg:inline-flex">
                  {now && <LiveDot tone="live" />}
                  {r.when}
                </span>
              </p>
              <h3 className={cn("heading-sm lg:pl-6", !now && "text-fg-2")}>{r.title}</h3>
              <p
                className={cn(
                  "body col-start-2 lg:col-span-2 lg:col-start-3 lg:pt-1 lg:pl-6",
                  now ? "text-fg-2" : "text-fg-3",
                )}
              >
                <span className="label-mono mr-2 text-fg-3 lg:hidden">{r.when} ·</span>
                {r.body}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ── Built on Monad (marquee; "Built with" — never "Backed by") ─────────────── */
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

/* ── Closing card ──────────────────────────────────────────────────────────── */
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
