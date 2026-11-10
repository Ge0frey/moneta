import type { Metadata } from "next";
import { MEMO_PLACEHOLDERS } from "./memo-template";
import { SITE_NAME, X_HANDLE } from "./site";

/** The static brand card (public/og.png), used wherever a route has no generated image of its own. */
export const DEFAULT_OG_IMAGE = {
  url: "/og.png",
  width: 2400,
  height: 1256,
  alt: "Moneta — Raise In Public. Spend By Verdict. Futarchy fundraising on Monad.",
};

type OgImage = { url: string; width: number; height: number; alt: string };

/**
 * Per-page metadata. Next merges metadata shallowly, so a page that sets only `title`/`description`
 * inherits the layout's whole `openGraph`/`twitter` objects (the homepage card). Every page goes through
 * this helper instead, which sets the title, description, canonical, og:url and both cards together.
 */
export function pageMetadata(o: {
  /** Short title; the layout template appends " · Moneta" unless `absolute` is set. */
  title: string;
  /** Use the title as-is (the home page). */
  absolute?: boolean;
  /** Title on share cards, when it should differ from the <title> (defaults to the full title). */
  cardTitle?: string;
  description: string;
  /** Path only ("/docs"); resolved against metadataBase. */
  path: string;
  /**
   * Card image. `null` = the route has a colocated opengraph-image/twitter-image file (file-based
   * metadata wins, so we emit no config image at all). Omitted = the static brand card.
   */
  image?: OgImage | null;
  noindex?: boolean;
  type?: "website" | "article";
}): Metadata {
  const full = o.cardTitle ?? (o.absolute ? o.title : `${o.title} · ${SITE_NAME}`);
  const images = o.image === null ? undefined : [o.image ?? DEFAULT_OG_IMAGE];
  return {
    title: o.absolute ? { absolute: o.title } : o.title,
    description: o.description,
    alternates: { canonical: o.path },
    openGraph: {
      type: o.type ?? "website",
      siteName: SITE_NAME,
      locale: "en_US",
      url: o.path,
      title: full,
      description: o.description,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      site: X_HANDLE,
      creator: X_HANDLE,
      title: full,
      description: o.description,
      ...(images ? { images } : {}),
    },
    ...(o.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Markdown → one line of plain text. */
export function plainText(md: string): string {
  return md
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // links and images → their text
    .replace(/^\s*\|.*\|\s*$/gm, " ") // table rows
    .replace(/[*_`~]/g, "") // emphasis and code markers hug their words: drop them
    .replace(/[#>|]/g, " ") // structural markers: become spaces
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

/** Cut at a word boundary and add an ellipsis when needed. */
export function clampText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/[\s,;:.–—-]+\S*$/, "")}…`;
}

/** The memo's Thesis section (or its first prose) as plain text, for descriptions and cards. */
export function memoThesis(md: string): string {
  const afterHeading = md.split(/^#{1,3}\s+Thesis\s*$/im)[1];
  const section = (afterHeading ?? md.replace(/^#\s+.*$/m, "")).split(/^#{1,3}\s/m)[0] ?? "";
  return plainText(section);
}

/** Words with at least one letter or digit (stray punctuation left by Markdown stripping doesn't count). */
export function wordCount(md: string): number {
  return plainText(md)
    .split(" ")
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** True when the memo still contains the create wizard's placeholder prose. */
export function isTemplateMemo(md: string): boolean {
  return Object.values(MEMO_PLACEHOLDERS).some((p) => md.includes(p));
}

/** Strip control, zero-width and bidi-override characters from user-supplied names before display. */
export function cleanLabel(s: string, max: number): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = s.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁠-⁩﻿]/g, "");
  return clampText(cleaned.trim(), max);
}
