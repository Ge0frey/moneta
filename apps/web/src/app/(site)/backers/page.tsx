import { ArticleShell } from "@/components/content/ArticleShell";
import { A, Em, H2, Note, P, Table, UL } from "@/components/content/prose";
import { contentMetadata, contentPage } from "@/lib/content";

const PATH = "/backers";
export const metadata = contentMetadata(PATH);

export default function Page() {
  return (
    <ArticleShell
      page={contentPage(PATH)}
      crumbs={[]}
      schema="WebPage"
      lede={
        <p>
          Back a team early, at the same price as everyone else, with protections a launchpad can’t
          offer: refunds if the raise falls short, spending decided by markets, and an exit at
          treasury value if the team stops delivering.
        </p>
      }
      toc={[
        ["protections", "Your protections"],
        ["spending", "How the money is spent"],
        ["exit", "Your exit"],
        ["evaluate", "How to evaluate a raise"],
        ["trade", "Trading and verdicts"],
      ]}
      related={[
        {
          href: "/learn/what-is-futarchy",
          label: "What is futarchy?",
          sub: "Why markets, not the founder, decide how your money is spent.",
        },
        {
          href: "/legal/risks",
          label: "Know the risks",
          sub: "Testnet status, contract risk, market risk and more.",
        },
      ]}
      cta={{
        href: "/explore",
        label: "Explore raises",
        secondary: { href: "/faq", label: "Read the FAQ" },
      }}
    >
      <H2 id="protections">Your protections</H2>
      <Table
        head={["Rule", "What it means for you"]}
        rows={[
          ["One price", "You pay the founder’s fixed price per token, like every other backer."],
          [
            "Minimum or nothing",
            "If the raise misses its minimum, every contribution is refunded in full, with no fee.",
          ],
          [
            "Fair oversubscription",
            "Above the maximum, each backer gets a pro-rata share and the excess back. Raises never close early, so timing doesn’t matter.",
          ],
          [
            "You pull your own claim",
            "Tokens and refunds are claimed per backer, so one blocked address can’t hold up anyone else.",
          ],
          [
            "Funds can’t be trapped",
            "If a raise still isn’t finalized after its grace period, anyone can abort it and refunds open.",
          ],
        ]}
      />

      <H2 id="spending">How the money is spent</H2>
      <P>
        After launch, the founder draws a streamed operating budget, fixed in the raise terms you
        accepted. <Em>Every other dollar needs a proposal</Em> that passes a pair of decision
        markets: one pricing the token if the proposal executes, one if it doesn’t. Milestone
        tranches, transfers, buybacks, budget changes and new token mints all go through the same
        test. No person holds the treasury’s keys, not even the founder.
      </P>
      <Note label="You can propose too">
        Anyone can make a proposal, not only the founder. Every proposer, founder included, posts
        the project’s USDC bond: returned on PASS, kept by the treasury on FAIL.
      </Note>

      <H2 id="exit">Your exit</H2>
      <P>
        Your token trades from launch in a spot pool owned by the treasury. And if the team stalls,
        you don’t have to sell into a falling market: anyone can propose a <Em>redemption</Em>. If
        the market agrees the treasury is worth more returned than spent, the budget stops,
        liquidity is pulled, treasury-held tokens are burned, and the remaining USDC is fixed
        against the supply. Every holder then burns tokens for exactly their share. Claim order
        doesn’t matter.
      </P>

      <H2 id="evaluate">How to evaluate a raise</H2>
      <UL
        items={[
          <>
            <Em>Read the memo.</Em> Does each tranche name a concrete deliverable? Moneta checks the
            memo against its on-chain hash and tells you if they match.
          </>,
          <>
            <Em>Check the terms.</Em> Price and implied valuation, minimum and maximum, the budget
            per month, and how much of the treasury sits in tranches versus the budget.
          </>,
          <>
            <Em>Look at the founder’s history.</Em> Each raise page shows the founder address’s past
            raises, launches and redemptions.
          </>,
          <>
            <Em>Check the governance settings.</Em> Thresholds, trading window and proposal bond
            decide how hard it is to spend the treasury.
          </>,
          <>
            <Em>Only commit what you can lose.</Em> Read the <A href="/legal/risks">risk page</A>{" "}
            first.
          </>,
        ]}
      />

      <H2 id="trade">Trading and verdicts</H2>
      <P>
        When a proposal opens, you can trade it: buy PASS if you think it makes the token worth
        more, FAIL if you think it doesn’t. A bet in one world never risks your stake in the other;
        if the world you bet on doesn’t happen, your USDC comes back. Traders who price proposals
        well are the signal that steers the treasury. See{" "}
        <A href="/learn/decision-markets">how decision markets work</A>.
      </P>
    </ArticleShell>
  );
}
