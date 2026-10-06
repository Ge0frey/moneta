import Link from "next/link";
import type { CSSProperties } from "react";
import { AsciiField } from "@/components/art/AsciiField";
import { Button } from "@/components/ui/button";

/* Plate geometry, in a 560-unit square. The circle is the compass circle; the dashed one is its φ-reduction. */
const C = 280;
const R = 228;
const PHI_R = R / 1.618;
const PHI_C = C + ((R - PHI_R) * Math.SQRT2) / 2;
const RULER = Array.from({ length: 30 }, (_, i) => {
  const x = C - R + 16 + i * 16;
  const h = i % 4 === 3 ? 5 : 2.5;
  return `M${x} ${C - h}V${C + h}`;
}).join("");

const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

/** Hero art: the ASCII temple of Juno Moneta inside a construction drawing, pinned to the 75% grid line. */
function Plate() {
  return (
    <div
      aria-hidden
      className="pointer-events-none relative mx-auto aspect-square w-full max-w-[440px] lg:absolute lg:top-1/2 lg:left-3/4 lg:w-[560px] lg:max-w-none lg:-translate-x-1/2 lg:-translate-y-1/2"
    >
      {/* crosshair arm, running out into the gutter */}
      <span
        className="animate-rise absolute top-1/2 left-full hidden h-px w-[50vw] bg-gradient-to-r from-white/15 to-transparent lg:block"
        style={delay(1.2)}
      />
      <div className="absolute inset-[9%] [mask-image:radial-gradient(circle_at_center,black_60%,transparent_75%)]">
        <AsciiField
          motif="temple"
          className="size-full"
          cell={10}
          zoom={0.25}
          speed={0.07}
          density={0.024}
          tilt={-0.36}
        />
      </div>
      <svg
        viewBox="0 0 560 560"
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        className="absolute inset-0 size-full overflow-visible"
      >
        <line x1={0} y1={C} x2={560} y2={C} pathLength={1} className="animate-draw text-white/15" />
        <line
          x1={C}
          y1={0}
          x2={C}
          y2={560}
          pathLength={1}
          className="animate-draw text-white/15"
          style={delay(0.15)}
        />
        <circle
          cx={C}
          cy={C}
          r={R}
          pathLength={1}
          className="animate-draw text-white/30"
          style={delay(0.3)}
          transform={`rotate(-90 ${C} ${C})`}
        />
        <circle
          cx={PHI_C}
          cy={PHI_C}
          r={PHI_R}
          strokeDasharray="2 6"
          className="animate-rise text-white/20"
          style={delay(1)}
        />
        <path d={RULER} className="animate-rise text-white/25" style={delay(1.1)} />
        <g className="animate-rise text-white/70" style={delay(1.3)}>
          {[
            [C - R, C],
            [C + R, C],
            [C, C - R],
            [C, C + R],
          ].map(([x, y]) => (
            <path key={`${x}-${y}`} d={`M${x! - 5} ${y}h10M${x} ${y! - 5}v10`} />
          ))}
        </g>
      </svg>
      <p
        className="label-mono animate-rise absolute top-[3%] right-[2%] text-right text-fg-3"
        style={delay(1.5)}
      >
        41.894° N
        <br />
        12.483° E
      </p>
      <p
        className="label-mono animate-rise absolute bottom-[1%] left-[2%] text-fg-3"
        style={delay(1.6)}
      >
        <span className="text-fg">Fig. I</span>
        <br />
        Aedes Ivnonis Monetae
      </p>
    </div>
  );
}

/** Hero: headline over the frame's left half; the plate sits on the 75% line and bleeds into the gutter. */
export function Hero() {
  return (
    <section className="relative flex min-h-[640px] flex-col justify-center gap-14 pt-20 pb-16 lg:min-h-[760px] lg:py-24">
      <div className="relative z-[2] flex flex-col gap-7">
        <h1 className="display-xl animate-rise max-w-[11ch]">Raise In Public. Spend By Verdict.</h1>
        <p className="body-lg animate-rise max-w-[42ch] text-fg" style={delay(0.1)}>
          Moneta is permissionless futarchy capital formation on Monad. Every dollar leaves a
          project&apos;s treasury only when the market says it creates value.
        </p>
        <div className="animate-rise flex flex-wrap gap-3" style={delay(0.2)}>
          <Button asChild size="lg">
            <Link href="/create">Launch a Raise</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/explore">Explore Raises</Link>
          </Button>
        </div>
      </div>
      <Plate />
    </section>
  );
}
