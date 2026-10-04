"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { motifPoints, type Motif } from "./motifs";

const RAMP = " .:-=+*#%@";

type Props = {
  motif: Motif;
  className?: string;
  /** Character cell height in px (width ≈ 0.62×). */
  cell?: number;
  /** Radians per second. */
  speed?: number;
  /** Scene scale relative to the shorter canvas side. */
  zoom?: number;
  /** Fixed tilt around X (radians). */
  tilt?: number;
  /** Fraction of empty cells sprinkled with faint noise characters (texture). */
  dust?: number;
  /** Surface sampling step in scene units (smaller = denser). */
  density?: number;
};

/**
 * ASCII field: grayscale 3D motif rendered as monospace characters. Decorative only
 * (aria-hidden). Paused off-screen; capped at ~30 fps; static under prefers-reduced-motion.
 */
export function AsciiField({
  motif,
  className,
  cell = 11,
  speed = 0.05,
  zoom = 0.36,
  tilt = -0.32,
  dust = 0.012,
  density = 0.04,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pts = motifPoints(motif, density);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const family = getComputedStyle(canvas).fontFamily || "monospace";

    let cols = 0,
      rows = 0,
      cw = 0,
      ch = cell,
      dpr = 1;
    let depth = new Float32Array(0);
    let lum = new Float32Array(0);
    let raf = 0;
    let visible = true;
    let last = 0;
    let angle = Math.random() * Math.PI * 2;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(r.width * dpr));
      canvas.height = Math.max(1, Math.floor(r.height * dpr));
      cw = cell * 0.62;
      cols = Math.max(1, Math.floor(r.width / cw));
      rows = Math.max(1, Math.floor(r.height / ch));
      depth = new Float32Array(cols * rows);
      lum = new Float32Array(cols * rows);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${Math.round(ch * 0.92)}px ${family}`;
      ctx.textBaseline = "top";
    };

    const lx = -0.45,
      ly = 0.75,
      lz = -0.48;
    const draw = () => {
      depth.fill(Infinity);
      lum.fill(0);
      const ca = Math.cos(angle),
        sa = Math.sin(angle);
      const ct = Math.cos(tilt),
        st = Math.sin(tilt);
      const scale = Math.min(cols * cw, rows * ch) * zoom;
      const cx = (cols * cw) / 2,
        cy = (rows * ch) / 2;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]!;
        // rotate Y then X
        const x1 = p.x * ca + p.z * sa;
        const z1 = -p.x * sa + p.z * ca;
        const y2 = p.y * ct - z1 * st;
        const z2 = p.y * st + z1 * ct;
        const nx1 = p.nx * ca + p.nz * sa;
        const nz1 = -p.nx * sa + p.nz * ca;
        const ny2 = p.ny * ct - nz1 * st;
        const nz2 = p.ny * st + nz1 * ct;
        if (nz2 > 0.15) continue; // back-facing
        const f = 4.2 / (z2 + 4.2);
        const sx = cx + x1 * scale * f;
        const sy = cy - y2 * scale * f;
        const c = Math.floor(sx / cw),
          r = Math.floor(sy / ch);
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
        const k = r * cols + c;
        if (z2 < depth[k]!) {
          depth[k] = z2;
          const diffuse = Math.max(0, -(nx1 * lx + ny2 * ly + nz2 * lz));
          lum[k] = Math.min(1, 0.24 + diffuse * 1.0 - z2 * 0.06);
        }
      }
      ctx.clearRect(0, 0, cols * cw, rows * ch);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const k = r * cols + c;
          let l = lum[k]!;
          if (l === 0) {
            if (Math.random() > dust) continue;
            l = 0.06 + Math.random() * 0.1;
          }
          const ch2 =
            RAMP[Math.min(RAMP.length - 1, Math.max(1, Math.floor(l * (RAMP.length - 1))))]!;
          const g = Math.round(43 + l * 212);
          ctx.fillStyle = `rgb(${g},${g},${g})`;
          ctx.fillText(ch2, c * cw, r * ch);
        }
      }
    };

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || t - last < 33) return;
      const dt = last ? (t - last) / 1000 : 0;
      last = t;
      angle += speed * dt;
      draw();
    };

    resize();
    draw();
    const ro = new ResizeObserver(() => {
      resize();
      draw();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
    });
    io.observe(canvas);
    if (!reduce) raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [motif, cell, speed, zoom, tilt, dust, density]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={cn("pointer-events-none block font-mono select-none", className)}
    />
  );
}
