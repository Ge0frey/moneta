/**
 * Share-card renderer (Open Graph / X), 1200×630, in the brand's monochrome plate style: black canvas,
 * hairline 4-column grid, registration crosses, Geist for statements and Geist Mono for facts.
 * Server-only. Cards never render memo text or URLs from user content (seo.md §3.5).
 */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { contentPage } from "./content";
import { clampText } from "./seo";
import { SITE_HOST } from "./site";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

type Font = { name: string; data: Buffer; weight: 400 | 500; style: "normal" };

/** Fonts load once per server instance. If they can't be read, the card still renders (default font). */
const fonts: Promise<Font[]> = (async () => {
  try {
    const dir = join(process.cwd(), "assets/fonts");
    const [medium, regular, mono] = await Promise.all([
      readFile(join(dir, "Geist-Medium.ttf")),
      readFile(join(dir, "Geist-Regular.ttf")),
      readFile(join(dir, "GeistMono-Regular.ttf")),
    ]);
    return [
      { name: "Geist", data: medium, weight: 500, style: "normal" },
      { name: "Geist", data: regular, weight: 400, style: "normal" },
      { name: "GeistMono", data: mono, weight: 400, style: "normal" },
    ];
  } catch {
    return [];
  }
})();

export type OgStat = { label: string; value: string };

const titleSize = (t: string) =>
  t.length <= 16 ? 96 : t.length <= 26 ? 78 : t.length <= 40 ? 62 : 52;

function Mark() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="#ffffff">
      <path d="M12 2 22 7.5V9H2V7.5L12 2Z" />
      <rect x="4" y="10.5" width="3" height="8" />
      <rect x="10.5" y="10.5" width="3" height="8" />
      <rect x="17" y="10.5" width="3" height="8" />
      <rect x="2" y="20" width="20" height="2" />
    </svg>
  );
}

function Cross({ x, y }: { x: number; y: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x - 7,
        top: y - 7,
        width: 15,
        height: 15,
        display: "flex",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 7,
          top: 0,
          width: 1,
          height: 15,
          background: "#8a8a8a",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 7,
          width: 15,
          height: 1,
          background: "#8a8a8a",
        }}
      />
    </div>
  );
}

/**
 * eyebrow: mono label top-right ("RAISE · OPEN"); title: the subject; sub: one plain line;
 * stats: up to three mono-labelled figures along the bottom.
 */
export async function renderCard(c: {
  eyebrow: string;
  title: string;
  sub?: string;
  stats?: OgStat[];
}): Promise<ImageResponse> {
  const W = OG_SIZE.width;
  const H = OG_SIZE.height;
  const cols = [W * 0.25, W * 0.5, W * 0.75];
  const stats = (c.stats ?? []).slice(0, 3);
  const loaded = await fonts;
  return new ImageResponse(
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#000000",
        color: "#ffffff",
        fontFamily: "Geist",
        padding: "60px 72px",
        position: "relative",
      }}
    >
      {cols.map((x) => (
        <div
          key={x}
          style={{
            position: "absolute",
            left: x,
            top: 0,
            width: 1,
            height: H,
            background: "#1c1c1c",
          }}
        />
      ))}
      {[36, H - 36].flatMap((y) =>
        [72, W / 2, W - 72].map((x) => <Cross key={`${x}-${y}`} x={x} y={y} />),
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Mark />
          <div style={{ fontSize: 34, fontWeight: 500, letterSpacing: -0.6 }}>Moneta</div>
        </div>
        <div style={{ fontFamily: "GeistMono", fontSize: 20, color: "#a3a3a3", letterSpacing: 2 }}>
          {c.eyebrow.toUpperCase()}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1000 }}>
        <div
          style={{
            fontSize: titleSize(c.title),
            fontWeight: 500,
            lineHeight: 1.04,
            letterSpacing: -2.2,
          }}
        >
          {c.title}
        </div>
        {c.sub ? (
          <div style={{ fontSize: 30, fontWeight: 400, color: "#a3a3a3", lineHeight: 1.3 }}>
            {c.sub}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 56 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{
                  fontFamily: "GeistMono",
                  fontSize: 17,
                  color: "#8a8a8a",
                  letterSpacing: 1.5,
                }}
              >
                {s.label.toUpperCase()}
              </div>
              <div style={{ fontSize: 38, fontWeight: 500, letterSpacing: -0.8 }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: "GeistMono", fontSize: 20, color: "#8a8a8a" }}>{SITE_HOST}</div>
      </div>
    </div>,
    { ...OG_SIZE, ...(loaded.length ? { fonts: loaded } : {}) },
  );
}

/** Share card for a registered reading page: its eyebrow, heading and a one-line summary. */
export function contentCard(path: string): Promise<ImageResponse> {
  const page = contentPage(path);
  const first = page.description.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? page.description;
  return renderCard({
    eyebrow: page.eyebrow,
    title: page.h1,
    sub: clampText(first, 130),
  });
}
