import type { Metadata } from "next";
import { pageMetadata } from "./seo";

/**
 * Registry of the reading pages (learn articles, guides, reference). One source for titles, descriptions
 * and dates, used by the pages themselves, the /learn hub, the sitemap, share cards and JSON-LD.
 * Bump `updated` whenever a page's substance changes (it becomes the sitemap lastmod and dateModified).
 */

export type ContentPage = {
  path: string;
  /** <title> (the template appends " · Moneta"). */
  title: string;
  /** On-page heading. */
  h1: string;
  description: string;
  /** Mono label above the heading and on the share card. */
  eyebrow: string;
  published: string;
  updated: string;
  readMinutes?: number;
};

export const LEARN: ContentPage[] = [
  {
    path: "/learn/what-is-futarchy",
    title: "What Is Futarchy? Decision Markets Explained",
    h1: "What Is Futarchy?",
    description:
      "Futarchy lets markets decide: traders price a project with a proposal and without it, and the higher price wins. How it works, where it fails, and who uses it.",
    eyebrow: "Learn · Futarchy",
    published: "2026-11-09",
    updated: "2026-11-09",
    readMinutes: 8,
  },
  {
    path: "/learn/decision-markets",
    title: "Decision Markets and Lagging-TWAP Verdicts",
    h1: "Decision Markets, From Split to Verdict.",
    description:
      "How a decision market works: conditional PASS and FAIL tokens, two pools, a lagging TWAP that shrugs off last-minute pumps, and a verdict anyone can finalize.",
    eyebrow: "Learn · Mechanism",
    published: "2026-11-09",
    updated: "2026-11-09",
    readMinutes: 7,
  },
  {
    path: "/learn/futarchy-vs-token-voting",
    title: "Futarchy vs Token Voting for DAO Treasuries",
    h1: "Futarchy vs Token Voting.",
    description:
      "Token votes are free to cast and free to get wrong; futarchy makes every opinion cost money. Side by side: turnout, whales, bribery and accountability.",
    eyebrow: "Learn · Governance",
    published: "2026-11-09",
    updated: "2026-11-09",
    readMinutes: 6,
  },
  {
    path: "/learn/futarchy-raise-vs-launchpad",
    title: "Futarchy Raise vs Launchpad vs VC Round",
    h1: "How Should a Crypto Startup Raise Its First Round?",
    description:
      "Grants, VCs, token launchpads, a plain ICO or a futarchy raise: what each gives founders and backers, and what happens to the money after the raise.",
    eyebrow: "Learn · Fundraising",
    published: "2026-11-09",
    updated: "2026-11-09",
    readMinutes: 6,
  },
];

export const GUIDES: ContentPage[] = [
  {
    path: "/founders",
    title: "Raise Your First Round On-Chain, on Monad",
    h1: "Raise In Public. Build With a Budget.",
    description:
      "Raise your first round from your community on Monad: one price for every backer, refunds below your minimum, a streamed budget and milestones paid by verdict.",
    eyebrow: "For founders",
    published: "2026-11-09",
    updated: "2026-11-09",
  },
  {
    path: "/backers",
    title: "Back a Raise With Refunds and Market Guardrails",
    h1: "Back Builders. Keep a Say in the Spend.",
    description:
      "For backers: one price for everyone, full refunds if a raise misses its minimum, spending decided by markets, and an exit at treasury value if a team stalls.",
    eyebrow: "For backers",
    published: "2026-11-09",
    updated: "2026-11-09",
  },
  {
    path: "/faq",
    title: "Moneta FAQ: Raises, Refunds, Verdicts and Risks",
    h1: "Questions, Answered.",
    description:
      "Answers about Moneta: how raises, refunds, proposals, PASS/FAIL verdicts, trading, redemption and fees work, who controls the treasury, and what the risks are.",
    eyebrow: "FAQ",
    published: "2026-11-09",
    updated: "2026-11-09",
  },
  {
    path: "/glossary",
    title: "Futarchy Glossary: Verdicts, TWAP and Tranches",
    h1: "Glossary.",
    description:
      "Plain definitions of the terms behind Moneta and futarchy: verdicts, PASS and FAIL tokens, the conditional vault, lagging TWAP, tranches and redemption.",
    eyebrow: "Reference",
    published: "2026-11-09",
    updated: "2026-11-09",
  },
  {
    path: "/about",
    title: "About: Futarchy Fundraising on Monad",
    h1: "A Mint That Takes Advice.",
    description:
      "Moneta is futarchy fundraising on Monad: open-source, immutable contracts where founders raise in public and markets decide how the treasury is spent.",
    eyebrow: "About",
    published: "2026-11-09",
    updated: "2026-11-09",
  },
  {
    path: "/legal/risks",
    title: "Risk Disclosure: Raising, Backing and Trading",
    h1: "Know the Risks.",
    description:
      "The risks of using Moneta: testnet status, unaudited contracts, market and liquidity risk, founder risk, USDC freezes and arbitrary-call proposals.",
    eyebrow: "Risk disclosure",
    published: "2026-11-09",
    updated: "2026-11-09",
  },
];

export const ALL_CONTENT = [...LEARN, ...GUIDES];

export function contentPage(path: string): ContentPage {
  const page = ALL_CONTENT.find((p) => p.path === path);
  if (!page) throw new Error(`No content registry entry for ${path}`);
  return page;
}

/** Metadata for a registered reading page (its share card is the colocated opengraph-image). */
export function contentMetadata(path: string): Metadata {
  const page = contentPage(path);
  return pageMetadata({
    title: page.title,
    description: page.description,
    path: page.path,
    image: null,
    type: "article",
  });
}
