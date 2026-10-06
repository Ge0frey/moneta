import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/* Thin-line construction glyphs for the lifecycle: solid strokes carry the idea, dashed strokes are
   the construction around it. 120-unit viewBox; colour comes from currentColor. */

function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      aria-hidden
      className={cn("size-[120px] overflow-visible", className)}
    >
      {children}
    </svg>
  );
}

const Dot = ({ x, y, r = 2 }: { x: number; y: number; r?: number }) => (
  <circle cx={x} cy={y} r={r} fill="currentColor" stroke="none" />
);

/** Raise: contributions converge on an escrow; the inner ring is the minimum, the outer the maximum. */
export function EscrowGlyph({ className }: { className?: string }) {
  const inflow = [-150, -95, -30, 35, 110, 160];
  return (
    <Frame className={className}>
      <circle
        cx={60}
        cy={60}
        r={52}
        strokeDasharray="2 5"
        className="animate-orbit opacity-50 [transform-box:fill-box] [transform-origin:center]"
      />
      <circle cx={60} cy={60} r={28} />
      {inflow.map((deg) => {
        const t = (deg * Math.PI) / 180;
        const [c, s] = [Math.cos(t), Math.sin(t)];
        return (
          <g key={deg}>
            <line
              x1={60 + c * 50}
              y1={60 + s * 50}
              x2={60 + c * 31}
              y2={60 + s * 31}
              strokeDasharray="1.5 3"
              className="opacity-40"
            />
            <Dot x={60 + c * 52} y={60 + s * 52} r={1.75} />
          </g>
        );
      })}
      <Dot x={60} y={60} r={2.5} />
    </Frame>
  );
}

/** Launch: one transaction, three bodies — token, liquidity, treasury — on one sphere. */
export function SphereGlyph({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <circle cx={60} cy={60} r={48} />
      <ellipse cx={60} cy={60} rx={48} ry={15} className="opacity-70" />
      <ellipse cx={60} cy={60} rx={20} ry={48} strokeDasharray="2 4" className="opacity-50" />
      <ellipse
        cx={60}
        cy={60}
        rx={48}
        ry={15}
        transform="rotate(-38 60 60)"
        strokeDasharray="2 4"
        className="opacity-35"
      />
      <Dot x={96} y={70} />
      <Dot x={36} y={25} />
      <Dot x={62} y={107.5} />
      <Dot x={60} y={60} r={1.5} />
    </Frame>
  );
}

/** Govern: a proposal forks into two worlds that meet at a single point — the verdict. */
export function ForkGlyph({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <line x1={0} y1={60} x2={120} y2={60} strokeDasharray="2 4" className="opacity-40" />
      <path d="M60 60C44 14 8 14 8 60S44 106 60 60" strokeDasharray="2 4" className="opacity-45" />
      <path
        d="M60 60C76 14 112 14 112 60S76 106 60 60"
        strokeDasharray="2 4"
        className="opacity-45"
      />
      <path d="M60 60C48 30 22 30 22 60S48 90 60 60" />
      <path d="M60 60C72 30 98 30 98 60S72 90 60 60" />
      <Dot x={0} y={60} />
      <Dot x={120} y={60} />
      <circle cx={60} cy={60} r={3.5} className="fill-canvas" />
    </Frame>
  );
}

/** Decide: the market weighs the world with the proposal against the world without it. */
export function BalanceGlyph({ className }: { className?: string }) {
  // beam pivots at (60, 34), tipped 10° toward the heavier side
  const [lx, ly, rx, ry] = [14.7, 42, 105.3, 26];
  return (
    <Frame className={className}>
      <line x1={60} y1={8} x2={60} y2={112} strokeDasharray="2 4" className="opacity-40" />
      <line x1={6} y1={34} x2={114} y2={34} strokeDasharray="2 4" className="opacity-35" />
      <line x1={lx} y1={ly} x2={rx} y2={ry} />
      <path d={`M${lx} ${ly}V74M${rx} ${ry}V58`} className="opacity-60" />
      <ellipse cx={lx} cy={76} rx={13} ry={3.5} />
      <ellipse cx={rx} cy={60} rx={13} ry={3.5} />
      <Dot x={lx} y={67.5} r={5} />
      <Dot x={rx} y={54.5} r={2.5} />
      <path d="M60 34l-5 9h10z" className="fill-canvas" />
      <path d="M50 112h20" />
      <Dot x={60} y={112} r={1.5} />
    </Frame>
  );
}
