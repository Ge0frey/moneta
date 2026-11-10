import { ArticleShell } from "@/components/content/ArticleShell";
import { A, Em, H2, Note, P, Table, UL } from "@/components/content/prose";
import { contentMetadata, contentPage } from "@/lib/content";

const PATH = "/learn/futarchy-vs-token-voting";
export const metadata = contentMetadata(PATH);

export default function Page() {
  return (
    <ArticleShell
      page={contentPage(PATH)}
      crumbs={[{ name: "Learn", path: "/learn" }]}
      lede={
        <p>
          Most DAO treasuries are governed by token votes. Votes are easy to run and easy to
          understand, but they cost nothing to get wrong. Futarchy replaces the vote on each
          decision with a market, where every opinion carries a price.
        </p>
      }
      toc={[
        ["voting", "What token voting gets wrong"],
        ["futarchy", "What futarchy changes"],
        ["compared", "Side by side"],
        ["limits", "Where futarchy is weaker"],
        ["both", "Use both"],
      ]}
      related={[
        {
          href: "/learn/what-is-futarchy",
          label: "What is futarchy?",
          sub: "The idea, a worked example and where it’s used today.",
        },
        {
          href: "/learn/decision-markets",
          label: "Decision markets, from split to verdict",
          sub: "How Moneta makes a market resistant to last-minute pumps.",
        },
      ]}
      cta={{
        href: "/docs",
        label: "How Moneta works",
        secondary: { href: "/explore", label: "Explore raises" },
      }}
    >
      <H2 id="voting">What token voting gets wrong</H2>
      <UL
        items={[
          <>
            <Em>Turnout is low.</Em> Reading a proposal takes time and a single vote rarely changes
            the result, so most holders don’t vote. Decisions fall to whoever shows up.
          </>,
          <>
            <Em>Whales decide.</Em> One token, one vote means the largest holders carry most of the
            weight, whether or not they understand the proposal.
          </>,
          <>
            <Em>Being wrong is free.</Em> A voter who backs a bad spend loses nothing personally for
            having been wrong, so there is little reason to do the homework.
          </>,
          <>
            <Em>Votes can be bought.</Em> Delegation markets and side deals let someone rent voting
            power for a single decision without holding the risk of the outcome.
          </>,
          <>
            <Em>It measures preference, not consequence.</Em> A vote tells you what people want to
            happen. It doesn’t tell you what they expect the decision to do to the project.
          </>,
        ]}
      />

      <H2 id="futarchy">What futarchy changes</H2>
      <P>
        Futarchy keeps the community’s goal fixed (make the project more valuable) and turns each
        decision into a question about consequences: is the token worth more in the world where this
        passes, or the world where it doesn’t? Two conditional markets answer it, and the proposal
        executes only if PASS trades higher by a preset threshold.
      </P>
      <UL
        items={[
          <>
            <Em>Opinions cost money</Em>, so careless and captured opinions lose influence over
            time.
          </>,
          <>
            <Em>Anyone can correct a mistake.</Em> A mispriced proposal is a profit opportunity for
            whoever notices it.
          </>,
          <>
            <Em>Size alone doesn’t win.</Em> A large holder who pushes a price away from fair value
            pays every arbitrageur who pushes it back, for as long as they hold it there.
          </>,
          <>
            <Em>It runs continuously</Em> over a multi-day window, so the decision reflects the
            whole period rather than one moment.
          </>,
        ]}
      />

      <H2 id="compared">Side by side</H2>
      <Table
        head={["", "Token voting", "Futarchy (as on Moneta)"]}
        rows={[
          [
            "Who decides",
            "Holders who vote, weighted by tokens",
            "Traders, weighted by money at risk",
          ],
          ["Cost of a wrong opinion", "None", "The position loses value in the world that happens"],
          [
            "Participation",
            "Often low; voting is a chore",
            "Anyone can trade; mispricing pays to fix",
          ],
          ["Large holders", "Decide by weight", "Pay to hold a price away from fair value"],
          [
            "Last-minute swings",
            "A late whale vote can flip it",
            "Lagging TWAP: late pumps barely register",
          ],
          [
            "Execution",
            "Often a multisig acts after the vote",
            "The verdict executes on-chain, automatically",
          ],
          ["Best for", "Values, rules, who we are", "Spending decisions with a measurable effect"],
        ]}
      />

      <H2 id="limits">Where futarchy is weaker</H2>
      <P>Futarchy is not free of tradeoffs. It needs:</P>
      <UL
        items={[
          <>
            <Em>Liquidity.</Em> A market with no depth tells you little. Moneta addresses this by
            moving part of each project’s treasury-owned liquidity into the decision pools.
          </>,
          <>
            <Em>A good goal.</Em> Token price is a proxy for value. Moneta anchors it with
            redemption: if a treasury is worth more returned than spent, holders can propose winding
            down and exit at their exact share.
          </>,
          <>
            <Em>Comfort with markets.</Em> Trading conditional tokens is less familiar than clicking
            “yes”. Moneta reduces it to one action: buy PASS or buy FAIL.
          </>,
        ]}
      />
      <Note label="Not for every question">
        “What should this project stand for?” is a question of values, not value. Futarchy is a tool
        for deciding how to reach an agreed goal, not for choosing the goal.
      </Note>

      <H2 id="both">Use both: vote on values, bet on beliefs</H2>
      <P>
        Robin Hanson’s original formula keeps a role for values. On Moneta, those values are set
        once, up front, in the raise’s fixed terms that backers accept: the operating budget, the
        milestone plan, the thresholds, the performance package. After launch, markets decide the
        spending inside those rules. Nobody votes on each transfer, and nobody, not even the
        founder, can move the treasury alone.
      </P>
      <P>
        Read <A href="/docs#treasury">how a Moneta treasury pays out</A> or see{" "}
        <A href="/backers">what backers get</A>.
      </P>
    </ArticleShell>
  );
}
