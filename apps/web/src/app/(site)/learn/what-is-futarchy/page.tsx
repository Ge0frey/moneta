import { ArticleShell } from "@/components/content/ArticleShell";
import { A, Em, H2, Note, OL, P, Table, UL } from "@/components/content/prose";
import { contentMetadata, contentPage } from "@/lib/content";
import { faqPage } from "@/lib/structured-data";

const PATH = "/learn/what-is-futarchy";
export const metadata = contentMetadata(PATH);

const QUICK = [
  {
    q: "Who invented futarchy?",
    a: "The economist Robin Hanson proposed futarchy around 2000, summed up as “vote on values, but bet on beliefs”.",
  },
  {
    q: "Is futarchy the same as a prediction market?",
    a: "No. A prediction market forecasts an event. Futarchy uses a pair of conditional markets to choose an action: one prices the outcome if the proposal happens, the other if it doesn’t, and the higher price wins.",
  },
  {
    q: "Can a whale manipulate a futarchy vote?",
    a: "Moving a verdict means holding a market away from fair value for much of the decision window while every arbitrageur profits by pushing it back. Moneta also uses a lagging time-weighted price, so a last-minute pump barely registers.",
  },
  {
    q: "Where is futarchy used today?",
    a: "MetaDAO uses it on Solana, Optimism and the Uniswap Foundation have tested it for grant funding, and Moneta uses it on Monad to govern the treasuries of projects that raise in public.",
  },
];

export default function Page() {
  return (
    <ArticleShell
      page={contentPage(PATH)}
      crumbs={[{ name: "Learn", path: "/learn" }]}
      lede={
        <p>
          Futarchy is a way to make decisions with markets instead of votes. For every proposal,
          traders price what a project is worth if it passes and what it is worth if it fails. The
          higher price wins.
        </p>
      }
      toc={[
        ["short-answer", "The short answer"],
        ["how-it-works", "How it works"],
        ["example", "A worked example"],
        ["why-markets", "Why markets, not votes"],
        ["objections", "Objections and answers"],
        ["in-crypto", "Futarchy in crypto"],
        ["moneta", "How Moneta uses it"],
        ["quick-answers", "Quick answers"],
      ]}
      related={[
        {
          href: "/learn/decision-markets",
          label: "Decision markets, from split to verdict",
          sub: "Conditional tokens, two pools and the lagging TWAP that decides.",
        },
        {
          href: "/learn/futarchy-vs-token-voting",
          label: "Futarchy vs token voting",
          sub: "Why a vote that costs nothing to get wrong is a weak signal.",
        },
      ]}
      cta={{
        href: "/explore",
        label: "See live decision markets",
        secondary: { href: "/docs#verdicts", label: "Read the verdict rules" },
      }}
      extraJsonLd={[faqPage(QUICK)]}
    >
      <H2 id="short-answer">The short answer</H2>
      <P>
        The economist Robin Hanson proposed futarchy around 2000 with a four-word summary:{" "}
        <Em>vote on values, but bet on beliefs</Em>. A community agrees on what it wants more of.
        Then, for each decision, it asks a market which choice gets more of it.
      </P>
      <P>
        In crypto, the thing to get more of is usually simple: the value of the project, as measured
        by the price of its token. So the question every proposal must answer is &ldquo;does this
        make the token worth more?&rdquo; Traders answer it with money.
      </P>
      <Note label="Definition">
        <Em>Futarchy</Em> is a decision rule. A proposal executes only when a market pricing the
        world where it passes trades higher than a market pricing the world where it fails.
      </Note>

      <H2 id="how-it-works">How it works</H2>
      <P>
        Futarchy runs on <Em>conditional markets</Em>: markets whose trades only count in one
        possible future. Every proposal opens two of them.
      </P>
      <OL
        items={[
          <>
            <Em>A proposal is made</Em>, for example “release $250,000 for the next milestone”.
          </>,
          <>
            <Em>Two markets open.</Em> The PASS market prices the token in the world where the
            proposal executes. The FAIL market prices it in the world where it doesn’t.
          </>,
          <>
            <Em>Traders take positions</Em> in whichever world they have a view on. A trade in the
            world that doesn’t happen is undone at the end, so nobody loses money on a future that
            never arrived.
          </>,
          <>
            <Em>The prices are compared</Em> over a fixed window, using a time-weighted average
            rather than the last trade.
          </>,
          <>
            <Em>The verdict executes itself.</Em> If PASS trades higher, by more than a preset
            threshold, the proposal runs on-chain. If not, nothing moves.
          </>,
        ]}
      />
      <P>
        The mechanics of splitting a dollar into a PASS dollar and a FAIL dollar, and of keeping the
        price hard to push around, are covered in{" "}
        <A href="/learn/decision-markets">decision markets, from split to verdict</A>.
      </P>

      <H2 id="example">A worked example</H2>
      <P>
        Lumen raises 1,000,000 USDC on Moneta. Months later the team ships its mainnet and asks for
        the next 250,000 USDC.
      </P>
      <Table
        head={["Proposal", "PASS world", "FAIL world", "Verdict"]}
        rows={[
          [
            "Release $250k for milestone 2",
            "$0.118 per token",
            "$0.104 per token",
            "PASS: the USDC goes to the team",
          ],
          [
            "Spend $400k on a celebrity endorsement",
            "lower than FAIL",
            "higher than PASS",
            "FAIL: the money stays put",
          ],
        ]}
      />
      <P>
        No vote, no multisig, no one signing off. Positions in the world that didn’t happen are
        simply unwound: a bet in one world never risks your stake in the other. Traders only gain or
        lose on the world that actually happens, which is exactly why their prices are worth
        listening to.
      </P>

      <H2 id="why-markets">Why markets, not votes</H2>
      <UL
        items={[
          <>
            <Em>Being wrong costs money.</Em> A token vote is free to cast and free to get wrong. A
            market position is not, so careless or captured opinions get priced out.
          </>,
          <>
            <Em>Anyone can correct a bad price.</Em> If a proposal is mispriced, the person who
            notices profits by fixing it. A vote has no such repair mechanism.
          </>,
          <>
            <Em>It aggregates what people know, not who they are.</Em> One well-informed trader can
            move a market; one well-informed voter is outvoted by a whale who never read the
            proposal.
          </>,
          <>
            <Em>It is continuous.</Em> Prices update every second, so the decision reflects the
            whole window, not the mood at the moment a vote closes.
          </>,
        ]}
      />
      <P>
        The full comparison, including where voting still has a role, is in{" "}
        <A href="/learn/futarchy-vs-token-voting">futarchy vs token voting</A>.
      </P>

      <H2 id="objections">Objections and answers</H2>
      <Table
        head={["Objection", "Answer (as Moneta implements it)"]}
        rows={[
          [
            "Markets are too thin to trust.",
            "Each proposal moves part of the project’s own treasury-owned liquidity into the two decision pools, so every market opens with depth, at the same price, without outside market makers.",
          ],
          [
            "A whale can pump the price at the last second.",
            "Verdicts compare time-weighted averages of a lagging observation that can move only a small step per second. A last-second pump barely registers, and holding a price away from fair value for days hands profit to everyone who pushes it back.",
          ],
          [
            "Token price is the wrong goal.",
            "It is a proxy, so Moneta anchors it: holders can always propose a redemption, and if it passes, every holder exits at their exact share of the treasury. A token can’t drift far below what it would return.",
          ],
          [
            "It is too complicated for normal users.",
            "Backing a proposal is one trade: buy PASS or buy FAIL. Your stake in the other world is never at risk, and after the verdict one click redeems every winning position.",
          ],
          [
            "Some questions are about values, not value.",
            "Agreed. Values are set up front, in the raise’s fixed rules: the budget, the milestones, the thresholds. Markets decide the spending inside those rules.",
          ],
        ]}
      />

      <H2 id="in-crypto">Futarchy in crypto</H2>
      <P>
        Futarchy stayed a thought experiment for years because it needs cheap, trustworthy markets
        that settle automatically. Blockchains supply all three. Vitalik Buterin described a
        futarchy DAO on Ethereum in{" "}
        <A href="https://blog.ethereum.org/2014/08/21/introduction-futarchy">a 2014 post</A>, and
        the idea has since moved from theory to practice:
      </P>
      <UL
        items={[
          <>
            <Em>MetaDAO</Em> governs itself and the projects that raise through it with futarchy, on
            Solana.
          </>,
          <>
            <Em>Optimism</Em> tested futarchy for allocating grants alongside its grants council and{" "}
            <A href="https://gov.optimism.io/t/futarchy-v1-preliminary-findings/10062">
              published its findings
            </A>
            .
          </>,
          <>
            The <Em>Uniswap Foundation</Em> has explored{" "}
            <A href="https://uniswapfoundation.org/conditional-funding-markets">
              conditional funding markets
            </A>{" "}
            for grants.
          </>,
          <>
            <Em>Moneta</Em> brings futarchy to Monad, where 300 ms blocks and cheap gas let decision
            markets run fully on-chain with a price observation every second.
          </>,
        ]}
      />

      <H2 id="moneta">How Moneta uses futarchy</H2>
      <P>
        Moneta applies futarchy to the hardest moment in a young project’s life: after the money is
        raised. A founder raises in public at one price for everyone. The raise launches a token, a
        market and a treasury that no person controls. The founder draws a streamed operating
        budget. Every other dollar, from milestone tranches to buybacks to winding the project down,
        is a proposal settled by a pair of decision markets.
      </P>
      <P>
        The result is <Em>accountable capital</Em>: money raised in public whose spending is
        governed by people with something at stake. See <A href="/docs">how Moneta works</A> for the
        full rules, or the <A href="/founders">founder guide</A> if you’re thinking of raising.
      </P>

      <H2 id="quick-answers">Quick answers</H2>
      <dl className="mt-5 flex max-w-[68ch] flex-col gap-6">
        {QUICK.map(({ q, a }) => (
          <div key={q}>
            <dt className="heading-sm">{q}</dt>
            <dd className="body mt-2 text-fg-2">{a}</dd>
          </div>
        ))}
      </dl>
      <P className="mt-10">
        Further reading: Robin Hanson’s{" "}
        <A href="https://mason.gmu.edu/~rhanson/futarchy.html">futarchy page</A> and the{" "}
        <A href="/glossary">Moneta glossary</A>.
      </P>
    </ArticleShell>
  );
}
