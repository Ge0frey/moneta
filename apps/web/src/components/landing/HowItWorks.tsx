import type { ComponentType } from "react";
import { BalanceGlyph, EscrowGlyph, ForkGlyph, SphereGlyph } from "@/components/art/Glyphs";
import { cn } from "@/lib/cn";
import { SectionHead } from "./SectionHead";

const STEPS: {
  verb: string;
  title: string;
  body: string;
  Glyph: ComponentType<{ className?: string }>;
}[] = [
  {
    verb: "Raise",
    title: "Backers fund a plan.",
    body: "A founder posts a plan, a price and a goal. Anyone can back it in USDC. Miss the goal and everyone is refunded.",
    Glyph: EscrowGlyph,
  },
  {
    verb: "Launch",
    title: "The project goes live.",
    body: "The token, its market and a treasury launch together. No one, not even the founder, holds the treasury's keys.",
    Glyph: SphereGlyph,
  },
  {
    verb: "Propose",
    title: "Spending is a proposal.",
    body: "The founder draws a streamed budget. Every other dollar needs a proposal, and anyone can make one.",
    Glyph: ForkGlyph,
  },
  {
    verb: "Decide",
    title: "The market decides.",
    body: "Traders price the token with the proposal and without it. Worth more with it? The money moves. If not, it stays.",
    Glyph: BalanceGlyph,
  },
];

/** II. How Moneta Works — four plain steps, one per frame column, joined by a track. */
export function HowItWorks() {
  return (
    <div className="flex flex-col gap-16">
      <SectionHead n="II" label="Overview" title="How Moneta Works">
        <p className="body-lg max-w-[46ch] text-fg-2">
          A founder raises money in public. After that, a market decides how it&apos;s spent, not
          the founder.
        </p>
      </SectionHead>

      <ol className="grid border-y border-line sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ verb, title, body, Glyph }, i) => (
          <li
            key={verb}
            className={cn(
              "group flex items-start gap-6 border-line py-8 sm:flex-col sm:gap-10 sm:px-6 sm:py-10 lg:gap-8",
              // 1 col → rule under each; 2 cols → under the first row; 4 cols → the frame lines divide them
              ["border-b lg:border-b-0", "border-b lg:border-b-0", "border-b sm:border-b-0", ""][i],
              i % 2 === 0 && "sm:pl-0",
              i === 2 && "lg:pl-6",
            )}
          >
            <Glyph className="size-[72px] shrink-0 text-fg-2 transition-colors duration-300 group-hover:text-fg sm:size-[120px]" />
            {/* the track: one segment per column, a node on each frame line, an arrow at the end */}
            <span
              aria-hidden
              className={cn(
                "relative -mr-6 hidden h-px self-stretch bg-line-strong lg:block",
                i > 0 && "-ml-6",
              )}
            >
              <span
                className={cn(
                  "absolute top-1/2 left-0 size-2 -translate-1/2 rounded-full",
                  i === 0 ? "bg-fg" : "border border-fg-2 bg-canvas",
                )}
              />
              {i === STEPS.length - 1 && (
                <span className="absolute top-1/2 right-0 size-2 -translate-y-1/2 rotate-45 border-t border-r border-fg-2" />
              )}
            </span>
            <div className="flex flex-col gap-3">
              <p className="label-mono text-fg-3">
                <span className="text-fg">0{i + 1}</span> — {verb}
              </p>
              <h3 className="heading-sm">{title}</h3>
              <p className="body-sm text-fg-2">{body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="grid gap-y-3 lg:grid-cols-4">
        <p className="label-mono text-fg-3 lg:pt-1">Always</p>
        <p className="body max-w-[60ch] text-fg-2 lg:col-span-3 lg:pl-6">
          <span className="text-fg">An exit no one can block.</span> If the market says a treasury
          is worth more returned than spent, every holder redeems their exact share.
        </p>
      </div>
    </div>
  );
}
