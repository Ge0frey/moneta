import { ArticleShell } from "@/components/content/ArticleShell";
import { contentMetadata, contentPage } from "@/lib/content";
import { definedTermSet } from "@/lib/structured-data";

const PATH = "/glossary";
export const metadata = contentMetadata(PATH);

/** Rendered alphabetically by term. `id` is the stable #anchor other pages link to. */
const ENTRIES: { id: string; term: string; definition: string }[] = [
  {
    id: "abort",
    term: "Abort",
    definition:
      "If a raise still isn't finalized after its grace period, anyone can abort it, which opens full refunds. It guarantees funds can't be trapped in an escrow.",
  },
  {
    id: "bond",
    term: "Proposal bond",
    definition:
      "USDC every proposer posts with a proposal. It is returned if the proposal passes and kept by the treasury if it fails, so spam costs money.",
  },
  {
    id: "conditional-token",
    term: "Conditional token",
    definition:
      "A token that is worth something only in one outcome of a proposal. PASS-USDC and PASS-{TOKEN} pay out if it passes; FAIL-USDC and FAIL-{TOKEN} if it fails. The losing side becomes worthless.",
  },
  {
    id: "conditional-vault",
    term: "Conditional vault",
    definition:
      "The contract that splits collateral into a PASS and a FAIL token, merges matched pairs back, and pays out the winning side after the verdict.",
  },
  {
    id: "decision-market",
    term: "Decision market",
    definition:
      "A pair of conditional markets used to make a decision: one prices the token if a proposal passes, the other if it fails. The comparison of their prices is the verdict.",
  },
  {
    id: "execution-grace",
    term: "Execution grace",
    definition:
      "The period after a PASS verdict during which anyone can retry a proposal's action if its first execution reverted. The verdict itself stands either way.",
  },
  {
    id: "finalize",
    term: "Finalize",
    definition:
      "The public call that settles a raise once its window ends (launch or refunds) or a proposal once its trading window ends (verdict, bond and execution). Anyone can call it; a keeper usually does within seconds.",
  },
  {
    id: "futarchy",
    term: "Futarchy",
    definition:
      "Governance in which markets, not votes, decide actions: a proposal executes only if the market pricing the world where it passes trades higher than the one where it fails. Proposed by Robin Hanson as “vote on values, but bet on beliefs”.",
  },
  {
    id: "keeper",
    term: "Keeper",
    definition:
      "A bot that calls public functions on time, such as finalizing raises and proposals. Keepers hold no special permission: anyone can make the same calls.",
  },
  {
    id: "lagging-observation",
    term: "Lagging observation",
    definition:
      "A per-pool price that moves toward the pool's spot price by at most a fixed step per second. Verdicts average it rather than spot, so short-lived price spikes barely count.",
  },
  {
    id: "launch",
    term: "Launch",
    definition:
      "The single transaction that turns a successful raise into a project: it takes the protocol fee, funds the treasury, creates the token and seeds the spot pool at the raise price. If any step fails, the whole launch rolls back.",
  },
  {
    id: "liquidity-share",
    term: "Liquidity share",
    definition:
      "The part of the net raise paired with newly minted tokens to seed the project's spot pool at the raise price. The treasury owns this liquidity and earns its trading fees.",
  },
  {
    id: "memo-hash",
    term: "Memo hash",
    definition:
      "The keccak256 hash of a Raise Memo or proposal memo, stored on-chain. The full text lives in event data; the app checks it against the hash and warns if they differ.",
  },
  {
    id: "musdc",
    term: "mUSDC",
    definition:
      "Moneta Test USDC: an open-mint test token on Monad testnet for trying large amounts. It has no value. Each raise shows whether it takes USDC or mUSDC.",
  },
  {
    id: "nav",
    term: "NAV (net asset value)",
    definition:
      "The treasury's quote assets divided by the circulating token supply: what each token would return if the treasury were redeemed.",
  },
  {
    id: "operating-budget",
    term: "Operating budget",
    definition:
      "USDC per month streamed to the founder by the second, set in the raise terms. It is the only money that leaves a treasury without a verdict, and it stops on redemption.",
  },
  {
    id: "pass-fail",
    term: "PASS and FAIL",
    definition:
      "The two possible verdicts, and the two sides of every decision market. PASS executes the proposal on-chain; FAIL leaves the capital where it is.",
  },
  {
    id: "performance-package",
    term: "Performance package",
    definition:
      "Optional token tranches for the team that mint only when the spot TWAP holds at a multiple of the raise price (such as 2×, 4×, 8×) over an unlock window, after a cliff. Nothing mints at launch.",
  },
  {
    id: "pro-rata",
    term: "Pro-rata allocation",
    definition:
      "How an oversubscribed raise is shared: each backer is allocated contribution × maximum ÷ total, and the excess is refunded.",
  },
  {
    id: "proposal",
    term: "Proposal",
    definition:
      "A request to move treasury funds or change a project: tranche release, transfer, budget change, mint, buyback, config update, founder change, arbitrary call or redemption. Each is settled by a decision market.",
  },
  {
    id: "raise",
    term: "Raise",
    definition:
      "A permissionless, fixed-price fundraise with a minimum, a maximum and a fixed window. Below the minimum everyone is refunded; above it, the project launches.",
  },
  {
    id: "raise-memo",
    term: "Raise Memo",
    definition:
      "The founder's public plan: thesis, team, milestones and use of funds. Backers fund it and traders later price proposals against it.",
  },
  {
    id: "redemption",
    term: "Redemption",
    definition:
      "Winding a project down by verdict. If a redemption passes, the budget stops, liquidity is pulled, treasury tokens are burned and holders burn their tokens for an exact pro-rata share of the remaining USDC.",
  },
  {
    id: "spot-pool",
    term: "Spot pool",
    definition:
      "The project token's main market against USDC, opened at the raise price and owned by the treasury. Each proposal moves part of its liquidity into the decision pools and the winning side's returns after the verdict.",
  },
  {
    id: "threshold",
    term: "Threshold (θ)",
    definition:
      "How far the PASS average must beat the FAIL average for a proposal to pass, in basis points. Defaults: 0 for tranche releases, +1% for other founder proposals, +3% for everyone else.",
  },
  {
    id: "tranche",
    term: "Milestone tranche",
    definition:
      "A share of the treasury, fixed in USDC at launch, reserved for a milestone and released to the founder only by a PASS verdict.",
  },
  {
    id: "twap",
    term: "TWAP",
    definition:
      "Time-weighted average price. Moneta integrates each pool's lagging observation exactly over the trading window, so the result doesn't depend on when anyone interacts with the pool.",
  },
  {
    id: "verdict",
    term: "Verdict",
    definition:
      "The outcome of a decision market: PASS if twapPass × 10,000 ≥ twapFail × (10,000 + θ), otherwise FAIL.",
  },
  {
    id: "warm-up",
    term: "Warm-up",
    definition:
      "The first part of a proposal's market, when prices form but don't count toward the TWAP. The trading window that decides the verdict starts after it.",
  },
];
const TERMS = [...ENTRIES].sort((a, b) => a.term.localeCompare(b.term, "en"));

export default function Page() {
  const page = contentPage(PATH);
  return (
    <ArticleShell
      page={page}
      crumbs={[]}
      schema="WebPage"
      lede={
        <p>
          Plain definitions of the terms behind Moneta and futarchy. Each entry has its own link.
        </p>
      }
      related={[
        {
          href: "/learn/what-is-futarchy",
          label: "What is futarchy?",
          sub: "The idea behind every term on this page.",
        },
        { href: "/faq", label: "FAQ", sub: "Short answers about raising, backing and trading." },
      ]}
      extraJsonLd={[definedTermSet({ name: "Moneta glossary", path: PATH, terms: TERMS })]}
    >
      <dl className="flex max-w-[68ch] flex-col divide-y divide-line-strong border-y border-line-strong">
        {TERMS.map((t) => (
          <div key={t.id} id={t.id} className="scroll-mt-24 py-5">
            <dt className="heading-sm">
              <a href={`#${t.id}`} className="hover:text-fg-2">
                {t.term}
              </a>
            </dt>
            <dd className="body mt-2 text-fg-2">{t.definition}</dd>
          </div>
        ))}
      </dl>
    </ArticleShell>
  );
}
