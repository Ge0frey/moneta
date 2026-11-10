/**
 * Titles, descriptions and the indexing quality gate for raise, project and proposal pages. Server-only.
 * See seo.md §3.2: on-chain pages are indexed only when INDEX_ONCHAIN is on AND the page passes the gate.
 */
import {
  actionTitle,
  big,
  decodeAction,
  formatScaledPrice,
  formatTokenPrice,
  formatUsd,
  type IndexedProposal,
  type IndexedRaise,
} from "@moneta/sdk";
import type { Metadata } from "next";
import { keccak256, toBytes, type Hex } from "viem";
import { quoteSym } from "@/lib/env";
import { isHidden } from "@/lib/hidden";
import { projectHref, proposalHref, raiseHref } from "@/lib/listing";
import {
  clampText,
  cleanLabel,
  isTemplateMemo,
  memoThesis,
  pageMetadata,
  wordCount,
} from "@/lib/seo";
import type { ProjectDetail, ProposalDetail, ProposalRow, RaiseDetail } from "@/lib/server/data";
import { INDEX_ONCHAIN } from "@/lib/site";

const DESCRIPTION_MAX = 158;
const MIN_RAISE_MEMO_WORDS = 150;
const MIN_PROPOSAL_MEMO_WORDS = 80;
const MIN_AGE_SECONDS = 86_400;

/** "Nov 12, 2026" in UTC: deterministic on any server. */
export function utcDate(seconds: number | string): string {
  return new Date(Number(seconds) * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const memoHashOk = (memo: string, hash: string) =>
  keccak256(toBytes(memo)).toLowerCase() === hash.toLowerCase();

/** Thesis excerpt + a factual tail, fitted to one description. */
function describe(memo: string, tail: string, fallback: string): string {
  const thesis = isTemplateMemo(memo) ? "" : memoThesis(memo);
  const room = DESCRIPTION_MAX - tail.length - 1;
  const lead = thesis && room >= 40 ? clampText(thesis, room) : fallback;
  return clampText(`${lead} ${tail}`, DESCRIPTION_MAX);
}

export const displayName = (name: string) => cleanLabel(name, 40) || "Untitled";
export const displaySymbol = (symbol: string) =>
  cleanLabel(symbol, 12).replace(/\s/g, "") || "TOKEN";

// ── raise ───────────────────────────────────────────────────────────────────

export function raiseIndexable(r: IndexedRaise): boolean {
  return (
    INDEX_ONCHAIN &&
    !isHidden(r.address) &&
    !r.aborted &&
    r.status !== "FAILED" &&
    memoHashOk(r.memo, r.memoHash) &&
    !isTemplateMemo(r.memo) &&
    wordCount(r.memo) >= MIN_RAISE_MEMO_WORDS &&
    Date.now() / 1000 - Number(r.createdAt) >= MIN_AGE_SECONDS
  );
}

export function raiseTitle(r: RaiseDetail): string {
  return `${displayName(r.name)} ($${displaySymbol(r.symbol)}) Raise on Monad`;
}

export function raiseDescription(r: RaiseDetail): string {
  const sym = `$${displaySymbol(r.symbol)}`;
  const q = quoteSym(r.quote);
  const price = formatTokenPrice(big(r.price));
  const goal = `${formatUsd(big(r.minRaise), 6, { compact: true })}–${formatUsd(big(r.maxRaise), 6, { compact: true })}`;
  const tail =
    r.status === "OPEN"
      ? Number(r.end) > Date.now() / 1000
        ? `Raising ${goal} in ${q} at ${price} per ${sym} until ${utcDate(r.end)}.`
        : `Raised in ${q} at ${price} per ${sym}; its window closed ${utcDate(r.end)} and it finalizes next.`
      : r.status === "SUCCEEDED"
        ? `Raised ${formatUsd(big(r.accepted), 6, { compact: true })} in ${q} at ${price} per ${sym}; its treasury is now governed by futarchy.`
        : `Missed its ${formatUsd(big(r.minRaise), 6, { compact: true })} minimum, so every backer is refunded in full.`;
  return describe(r.memo, tail, `${displayName(r.name)} raises in public on Moneta.`);
}

export function raiseMetadata(address: string, r: RaiseDetail | null): Metadata {
  const path = raiseHref(address);
  if (!r)
    return pageMetadata({
      title: "Raise",
      description: "A permissionless raise on Moneta, futarchy fundraising on Monad.",
      path,
      noindex: true,
    });
  return pageMetadata({
    title: raiseTitle(r),
    description: raiseDescription(r),
    path,
    image: null, // colocated opengraph-image / twitter-image
    noindex: !raiseIndexable(r),
  });
}

// ── project ─────────────────────────────────────────────────────────────────

export function projectIndexable(p: { treasury: string }, raise: IndexedRaise | null): boolean {
  return !!raise && raiseIndexable(raise) && !isHidden(p.treasury);
}

export function projectDescription(
  p: ProjectDetail,
  raise: RaiseDetail | null,
  proposals: ProposalRow[] | null,
): string {
  const sym = `$${displaySymbol(p.symbol)}`;
  const n = proposals?.length ?? p.proposalCount;
  const price =
    big(p.lastPrice) > 0n
      ? formatScaledPrice(big(p.lastPrice))
      : raise
        ? formatTokenPrice(big(raise.price))
        : undefined;
  const tail =
    p.state === "REDEEMED"
      ? `Redeemed: holders exited at NAV after a ${n}-proposal futarchy history on Monad.`
      : `Governed by futarchy on Monad: ${n} proposal${n === 1 ? "" : "s"}${price ? `, ${sym} at ${price}` : ""}.`;
  return describe(
    raise?.memo ?? "",
    tail,
    `${displayName(p.name)} is a market-governed treasury on Moneta.`,
  );
}

export function projectMetadata(
  treasury: string,
  p: ProjectDetail | null,
  raise: RaiseDetail | null,
  proposals: ProposalRow[] | null,
): Metadata {
  const path = projectHref(treasury);
  if (!p)
    return pageMetadata({
      title: "Project",
      description: "A market-governed treasury on Moneta, futarchy fundraising on Monad.",
      path,
      noindex: true,
    });
  return pageMetadata({
    title: `${displayName(p.name)} ($${displaySymbol(p.symbol)}): Treasury, Price and Proposals`,
    description: projectDescription(p, raise, proposals),
    path,
    image: null,
    noindex: !projectIndexable(p, raise),
  });
}

// ── proposal ────────────────────────────────────────────────────────────────

export function proposalActionTitle(pr: { actionType: number; actionData: string }): string {
  try {
    return actionTitle(decodeAction(pr.actionType, pr.actionData as Hex));
  } catch {
    return "Proposal";
  }
}

export function proposalIndexable(
  pr: IndexedProposal,
  p: { treasury: string } | null,
  raise: IndexedRaise | null,
): boolean {
  return (
    !!p &&
    projectIndexable(p, raise) &&
    pr.status !== "CANCELLED" &&
    memoHashOk(pr.memo, pr.memoHash) &&
    wordCount(pr.memo) >= MIN_PROPOSAL_MEMO_WORDS
  );
}

export function proposalDescription(pr: ProposalDetail, p: ProjectDetail | null): string {
  const twaps =
    pr.twapPass && pr.twapFail
      ? `: PASS ${formatScaledPrice(big(pr.twapPass))} vs FAIL ${formatScaledPrice(big(pr.twapFail))}.`
      : ".";
  const tail = {
    QUEUED: "Queued behind the live proposal; its markets open next.",
    ACTIVE: pr.tradingEnd
      ? `Live PASS/FAIL markets decide it by ${utcDate(pr.tradingEnd)}.`
      : "Live PASS/FAIL markets decide it.",
    PASSED: `Passed by futarchy verdict${twaps}`,
    EXECUTED: `Passed and executed on-chain${twaps}`,
    FAILED: `Failed its futarchy verdict${twaps} The treasury kept the funds.`,
    CANCELLED: "Cancelled before its markets opened.",
  }[pr.status];
  const who = p ? displayName(p.name) : "A Moneta project";
  return describe(pr.memo, tail, `${who}: ${proposalActionTitle(pr).toLowerCase()}.`);
}

export function proposalMetadata(
  treasury: string,
  id: string,
  pr: ProposalDetail | null,
  p: ProjectDetail | null,
  raise: RaiseDetail | null,
): Metadata {
  const path = proposalHref(treasury, id);
  if (!pr)
    return pageMetadata({
      title: `Proposal #${id}`,
      description: "A futarchy decision market on Moneta: PASS and FAIL markets decide the spend.",
      path,
      noindex: true,
    });
  const who = p ? `${displayName(p.name)} ` : "";
  return pageMetadata({
    title: `${who}Proposal #${id}: ${proposalActionTitle(pr)}`,
    description: proposalDescription(pr, p),
    path,
    image: null,
    noindex: !proposalIndexable(pr, p, raise),
  });
}
