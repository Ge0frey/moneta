"use client";

import {
  ColorType,
  createChart,
  CrosshairMode,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type ChartPoint = { time: number; value: number };
export type ChartSeries = {
  id: string;
  label: string;
  color: string;
  /** solid 2px (TWAP), faint 1px (spot), dashed 1px (threshold) */
  style: "solid" | "faint" | "dashed";
  data: ChartPoint[];
  /** Legend glyph (▲ / ▼) so identity never relies on color alone. */
  glyph?: string;
};

/** Strictly increasing times (keep the last value per second) — lightweight-charts requirement. */
function clean(data: ChartPoint[]) {
  const byTime = new Map<number, number>();
  for (const p of data) if (Number.isFinite(p.value)) byTime.set(Math.floor(p.time), p.value);
  return [...byTime.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([time, value]) => ({ time: time as UTCTimestamp, value }));
}

/**
 * lightweight-charts renders every timestamp as UTC, so shift chain times to the viewer's wall clock (the library's
 * documented `timeToLocal` recipe) to match the local times shown everywhere else. Re-cleaned because a DST
 * fall-back maps two seconds onto one.
 */
function toLocalChartTime(data: ChartPoint[]) {
  return clean(
    data.map(({ time, value }) => {
      const d = new Date(time * 1000);
      const local = Date.UTC(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        d.getHours(),
        d.getMinutes(),
        d.getSeconds(),
      );
      return { time: local / 1000, value };
    }),
  );
}

/** Price chart (TradingView lightweight-charts), themed from Moneta tokens. */
export function PriceChart({
  series,
  height = 320,
  formatValue = (v) => `$${v.toFixed(4)}`,
  className,
  ariaLabel,
}: {
  series: ChartSeries[];
  height?: number;
  formatValue?: (v: number) => string;
  className?: string;
  ariaLabel: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const handles = useRef(new Map<string, ISeriesApi<"Line">>());
  const [table, setTable] = useState(false);
  /** Keep the whole window in view as data streams in, until the user zooms or pans. */
  const interacted = useRef(false);

  useEffect(() => {
    if (!el.current) return;
    const family = getComputedStyle(document.body).getPropertyValue("--font-mono") || "monospace";
    const c = createChart(el.current, {
      height,
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8a8a8a",
        fontFamily: family,
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: "#171717" } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: true },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: "#3d3d3d",
          width: 1,
          style: LineStyle.Solid,
          labelBackgroundColor: "#222222",
        },
        horzLine: {
          color: "#3d3d3d",
          width: 1,
          style: LineStyle.Solid,
          labelBackgroundColor: "#222222",
        },
      },
      localization: { priceFormatter: formatValue },
    });
    chart.current = c;
    const map = handles.current;
    return () => {
      map.clear();
      c.remove();
      chart.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    const seen = new Set<string>();
    for (const s of series) {
      seen.add(s.id);
      let h = handles.current.get(s.id);
      if (!h) {
        h = c.addSeries(LineSeries, {
          color: s.style === "faint" ? `${s.color}73` : s.color,
          lineWidth: s.style === "solid" ? 2 : 1,
          lineStyle: s.style === "dashed" ? LineStyle.Dashed : LineStyle.Solid,
          priceLineVisible: false,
          lastValueVisible: s.style === "solid",
          crosshairMarkerRadius: 4,
          crosshairMarkerBorderColor: "#191919",
          crosshairMarkerBorderWidth: 2,
          title: "",
        });
        handles.current.set(s.id, h);
      }
      h.setData(toLocalChartTime(s.data));
    }
    for (const [id, h] of handles.current) {
      if (!seen.has(id)) {
        c.removeSeries(h);
        handles.current.delete(id);
      }
    }
    if (!interacted.current) c.timeScale().fitContent();
  }, [series]);

  const rows = useMemo(() => {
    const solid = series.filter((s) => s.style === "solid");
    const times = [...new Set(solid.flatMap((s) => clean(s.data).map((p) => p.time)))]
      .sort((a, b) => b - a)
      .slice(0, 20);
    return times.map((t) => ({
      t,
      values: solid.map(
        (s) =>
          clean(s.data)
            .filter((p) => p.time <= t)
            .at(-1)?.value,
      ),
    }));
  }, [series]);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {series.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-2 mono-xs text-fg-2">
            <span
              aria-hidden
              className="inline-block w-4"
              style={{
                borderTop: `${s.style === "solid" ? 2 : 1}px ${s.style === "dashed" ? "dashed" : "solid"} ${s.style === "faint" ? `${s.color}73` : s.color}`,
              }}
            />
            {s.glyph ? `${s.glyph} ` : ""}
            {s.label}
          </span>
        ))}
        <button
          type="button"
          onClick={() => setTable((v) => !v)}
          className="ml-auto mono-xs text-fg-3 underline-offset-2 hover:text-fg hover:underline"
        >
          {table ? "Chart" : "Table"}
        </button>
      </div>
      <div
        ref={el}
        role="img"
        aria-label={ariaLabel}
        className={cn("w-full", table && "hidden")}
        style={{ height }}
        onWheel={() => (interacted.current = true)}
        onPointerDown={() => (interacted.current = true)}
      />
      {table && (
        <div className="max-h-[320px] overflow-auto">
          <table className="w-full body-sm tabular">
            <thead>
              <tr className="mono-xs text-fg-3 uppercase">
                <th className="py-2 text-left font-normal">Time</th>
                {series
                  .filter((s) => s.style === "solid")
                  .map((s) => (
                    <th key={s.id} className="py-2 text-right font-normal">
                      {s.label}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.t} className="border-t border-line-strong">
                  <td className="py-2">{new Date(r.t * 1000).toLocaleTimeString()}</td>
                  {r.values.map((v, i) => (
                    <td key={i} className="py-2 text-right">
                      {v === undefined ? "—" : formatValue(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
