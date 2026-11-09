import { ArticleShell } from "@/components/content/ArticleShell";
import { A, Em, Formula, H2, Note, OL, P, Table, UL } from "@/components/content/prose";
import { contentMetadata, contentPage } from "@/lib/content";

const PATH = "/learn/decision-markets";
export const metadata = contentMetadata(PATH);

export default function Page() {
  return (
    <ArticleShell
      page={contentPage(PATH)}
      crumbs={[{ name: "Learn", path: "/learn" }]}
      schema="TechArticle"
      lede={
        <p>
          A decision market asks one question, “is the token worth more if this proposal passes?”,
          and answers it with two markets and a clock. Here is every step, from the moment a
          proposal opens to the moment its verdict executes on-chain.
        </p>
      }
      toc={[
        ["split", "The split"],
        ["pools", "Two pools, one price"],
        ["trading", "Trading a world"],
        ["lagging-twap", "The lagging TWAP"],
        ["verdict", "The verdict"],
        ["settlement", "Settlement"],
        ["manipulation", "What it costs to move"],
        ["why-monad", "Why a fast chain"],
      ]}
      related={[
        {
          href: "/learn/what-is-futarchy",
          label: "What is futarchy?",
          sub: "The idea behind decision markets, with a worked example.",
        },
        {
          href: "/docs#verdicts",
          label: "Verdict rules in the docs",
          sub: "The exact formulas and thresholds Moneta’s contracts enforce.",
        },
      ]}
      cta={{
        href: "/explore?status=verdict",
        label: "Open a live market",
        secondary: { href: "/glossary", label: "Glossary" },
      }}
    >
      <H2 id="split">The split: one dollar becomes two</H2>
      <P>
        Everything starts in the <Em>conditional vault</Em>. Deposit 1 USDC and you receive 1
        PASS-USDC and 1 FAIL-USDC. Each is a claim on the dollar in one possible future: PASS-USDC
        pays out if the proposal passes, FAIL-USDC if it fails. Holding one of each is exactly as
        good as holding the dollar, so you can merge a matched pair back into USDC at any time.
      </P>
      <P>
        The project’s token splits the same way, into PASS-{"{TOKEN}"} and FAIL-{"{TOKEN}"}. After
        the verdict, the winning side redeems 1:1 for the real asset and the losing side is worth
        nothing.
      </P>

      <H2 id="pools">Two pools, one starting price</H2>
      <P>
        When a proposal opens, part of the project’s spot liquidity moves into two new pools: PASS-
        {"{TOKEN}"} against PASS-USDC, and FAIL-{"{TOKEN}"} against FAIL-USDC. Both open at the same
        price. The PASS pool prices the token in the world where the proposal executes; the FAIL
        pool prices it in the world where it doesn’t.
      </P>
      <Note label="Why treasury-owned liquidity">
        The treasury is the only liquidity provider, so every decision market opens with real depth
        on day one, and nobody needs to be paid to make a market. When the verdict lands, the
        winning side’s liquidity returns to the spot pool.
      </Note>

      <H2 id="trading">Trading a world</H2>
      <P>
        Say you think the proposal adds value. Buying PASS with 10 USDC splits it into 10 PASS-USDC
        and 10 FAIL-USDC, then swaps the PASS-USDC for PASS-{"{TOKEN}"}. Two outcomes:
      </P>
      <UL
        items={[
          <>
            <Em>It passes.</Em> Your PASS-{"{TOKEN}"} redeems 1:1 for the token, bought at the PASS
            world’s price.
          </>,
          <>
            <Em>It fails.</Em> Your PASS-{"{TOKEN}"} is worthless, but your 10 FAIL-USDC redeems
            1:1, so you get your 10 USDC back.
          </>,
        ]}
      />
      <P>
        A bet in one world never risks your stake in the other. Selling reverses the steps and
        merges matched pairs back into USDC. On Moneta both directions are one transaction through
        the router.
      </P>

      <H2 id="lagging-twap">The lagging TWAP</H2>
      <P>
        A naive verdict would compare the two pools’ prices at the deadline. That invites a
        last-second pump. Moneta instead gives each pool a <Em>lagging observation</Em>: a price
        that moves toward the pool’s spot price by at most a fixed step per second. The verdict
        compares time-weighted averages (TWAPs) of those observations over the trading window, after
        a warm-up period that doesn’t count.
      </P>
      <Formula caption="Per pool, integrated exactly in closed form, so the result doesn't depend on when anyone cranks">
        {`observation(t) moves toward spot at ≤ maxStep per second
TWAP = ∫ observation dt over [tradingStart, tradingEnd] ÷ duration`}
      </Formula>
      <P>
        Because the observation can only follow spot so fast, a spike that lasts minutes moves it
        very little, and a spike in the final seconds barely moves the average at all.
      </P>

      <H2 id="verdict">The verdict</H2>
      <Formula caption="Threshold θ in basis points">
        {`PASS  ⇔  twapPass × 10,000 ≥ twapFail × (10,000 + θ)`}
      </Formula>
      <P>The threshold sets how much better the PASS world has to look:</P>
      <Table
        head={["Proposal", "Default threshold θ", "What PASS needs"]}
        rows={[
          [
            "Tranche release (milestone money)",
            "0",
            "PASS TWAP at least equal to FAIL; backers agreed to the milestone plan at the raise",
          ],
          ["Other founder proposals", "+1%", "PASS TWAP at least 1% above FAIL"],
          ["Everyone else", "+3%", "PASS TWAP at least 3% above FAIL"],
        ]}
      />
      <P>
        Proposers also post a bond in USDC. It comes back when the proposal passes and stays in the
        treasury when it fails, so spam costs money. Only one proposal is live per project at a
        time, so proposals can’t double-spend the treasury or move each other’s prices.
      </P>

      <H2 id="settlement">Settlement</H2>
      <OL
        items={[
          <>Anyone can finalize once the window ends; a keeper usually does it within seconds.</>,
          <>Finalizing resolves the markets and returns the winning side’s liquidity to spot.</>,
          <>The bond is settled: refunded on PASS, kept by the treasury on FAIL.</>,
          <>
            On PASS, the action executes on-chain. If execution reverts, the verdict still stands
            and anyone can retry until the execution grace period ends.
          </>,
          <>Traders redeem winning positions 1:1, in one click.</>,
        ]}
      />

      <H2 id="manipulation">What it costs to move a verdict</H2>
      <P>
        To force a result, a manipulator has to hold one pool’s price away from fair value for much
        of a multi-day window. The step cap limits how fast the observation can follow any push, and
        every arbitrageur who sees the mispricing profits by pushing it back. The manipulator is
        paying everyone else to disagree with them, for days, in a market where the treasury itself
        provides the depth.
      </P>
      <P>
        That is the economic heart of futarchy: a wrong price is an opportunity, so wrong prices
        don’t last. For the broader case against vote-based treasuries, see{" "}
        <A href="/learn/futarchy-vs-token-voting">futarchy vs token voting</A>.
      </P>

      <H2 id="why-monad">Why this needs a fast chain</H2>
      <P>
        Two markets that trade for days and record a price observation every second need a chain
        that is fast and cheap. Monad produces a block every 300 ms and finalizes in about 600 ms.
        Block timestamps have one-second granularity, so observations update at most once per
        second, and full EVM compatibility means a passed proposal can call any contract on Monad.
      </P>
    </ArticleShell>
  );
}
