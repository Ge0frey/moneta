import { ArticleShell } from "@/components/content/ArticleShell";
import { A, Em, H2, Note, OL, P, Table, UL } from "@/components/content/prose";
import { VideoFacade } from "@/components/content/VideoFacade";
import { contentMetadata, contentPage } from "@/lib/content";
import { DEMO_VIDEO_ID } from "@/lib/site";

const PATH = "/founders";
export const metadata = contentMetadata(PATH);

export default function Page() {
  return (
    <ArticleShell
      page={contentPage(PATH)}
      crumbs={[]}
      schema="WebPage"
      lede={
        <p>
          Raise your first round from the people who already use your product: in public, at one
          price, without a gatekeeper. You get a budget from day one. The rest of the money is
          released as the market agrees you’ve earned it.
        </p>
      }
      toc={[
        ["who", "Who it’s for"],
        ["get", "What you get"],
        ["give", "What you give up"],
        ["how", "How a raise runs"],
        ["terms", "The terms you set"],
        ["memo", "Write a memo backers can price"],
        ["demo", "Watch the demo"],
      ]}
      related={[
        {
          href: "/learn/futarchy-raise-vs-launchpad",
          label: "Futarchy raise vs launchpad vs VC",
          sub: "How the options compare, and what happens after the money lands.",
        },
        {
          href: "/docs#raises",
          label: "Raise rules in the docs",
          sub: "Refunds, pro-rata allocation, finalizing and the exit guarantee.",
        },
      ]}
      cta={{
        href: "/create",
        label: "Create a raise",
        secondary: { href: "/explore", label: "See live raises" },
      }}
    >
      <H2 id="who">Who it’s for</H2>
      <P>
        Teams of a few people building on Monad, with a working product, real users and a community
        that wants in. Teams that need a first round to fund a multi-year plan, don’t have a warm
        introduction to a VC, and have no interest in launching a memecoin.
      </P>

      <H2 id="get">What you get</H2>
      <UL
        items={[
          <>
            <Em>A raise without a gatekeeper.</Em> No application, no allowlist. Publish your memo
            and terms and your community can back you the same day.
          </>,
          <>
            <Em>A budget from day one</Em>, streamed to you by the second for as long as the project
            is active. You claim what has accrued whenever you like.
          </>,
          <>
            <Em>Milestone funding on your terms.</Em> You set the tranches at the raise. By default,
            releasing one needs only that PASS trades at least level with FAIL.
          </>,
          <>
            <Em>A liquid community.</Em> Your token trades from launch in a pool seeded at the raise
            price and owned by your treasury, so its trading fees accrue to the project.
          </>,
          <>
            <Em>Upside tied to results.</Em> An optional performance package mints extra tokens to
            the team only when the token holds at a multiple of the raise price, such as 2×, 4× or
            8×.
          </>,
        ]}
      />

      <H2 id="give">What you give up</H2>
      <P>
        <Em>Control of the treasury.</Em> Beyond the streamed budget, every dollar leaves only
        through a proposal that passes its decision markets. That is the point: it’s why backers can
        trust a public raise from a team they’ve never met. And if the market decides the treasury
        is worth more returned than spent, holders can redeem it.
      </P>
      <Note label="Immutable by design">
        The contracts can’t be upgraded. Nobody, Moneta included, can change your project’s rules,
        move its funds or pause its markets. Only a proposal that passes its markets can change
        anything, from the budget to the governance settings.
      </Note>

      <H2 id="how">How a raise runs</H2>
      <OL
        items={[
          <>
            <Em>Write the Raise Memo</Em> and set your terms in the{" "}
            <A href="/create">create wizard</A>. The memo’s hash is stored on-chain, so backers can
            verify it was never edited.
          </>,
          <>
            <Em>Publish.</Em> Your raise page is live immediately, with its own share card. It’s the
            link you post on X, Discord and Telegram.
          </>,
          <>
            <Em>The window runs</Em> for the length you chose. It never closes early, so late
            backers aren’t disadvantaged.
          </>,
          <>
            <Em>Finalize.</Em> Anyone can finalize when the window ends; a keeper does it within
            seconds. Below the minimum, everyone is refunded in full.
          </>,
          <>
            <Em>Launch, atomically:</Em> your token, the spot pool and the treasury go live in one
            transaction. If any step fails, the whole launch rolls back.
          </>,
          <>
            <Em>Build.</Em> Claim your budget as it streams. Propose tranche releases as you hit
            milestones.
          </>,
        ]}
      />

      <H2 id="terms">The terms you set</H2>
      <Table
        head={["Term", "What it does"]}
        rows={[
          ["Price per token", "One price for every backer. FDV follows from it."],
          [
            "Minimum and maximum",
            "Below the minimum, full refunds. Above the maximum, pro-rata allocation and refunds of the excess.",
          ],
          ["Raise window", "How long contributions stay open."],
          ["Raise currency", "USDC (or the mUSDC test token on testnet)."],
          [
            "Liquidity share",
            "The share of the net raise paired with new tokens to seed the spot pool at the raise price.",
          ],
          ["Operating budget", "USDC per month, streamed to the founder address."],
          [
            "Milestone tranches",
            "Shares of the treasury, fixed in USDC at launch, each released by a PASS verdict.",
          ],
          [
            "Performance package",
            "Optional token tranches that mint only when the TWAP holds at a multiple of the raise price, after a cliff.",
          ],
          [
            "Governance settings",
            "Warm-up, trading window, thresholds, liquidity migrated per proposal, oracle step cap, execution grace and proposal bond.",
          ],
        ]}
      />
      <P>
        Every field shows its allowed range in the wizard. Bounds for new raises are set by the
        protocol and listed on the <A href="/status">status page</A>.
      </P>

      <H2 id="memo">Write a memo backers can price</H2>
      <P>
        Traders decide your milestone releases, so your memo is the document they’ll price. Vague
        memos get discounted. Specific ones get funded.
      </P>
      <UL
        items={[
          <>
            <Em>Thesis:</Em> what you’re building, for whom, and why now, in plain words.
          </>,
          <>
            <Em>Team:</Em> who is building it and what you’ve shipped before. Link to the work.
          </>,
          <>
            <Em>Milestones:</Em> one concrete, checkable deliverable per tranche (“mainnet with
            1,000 weekly users”, not “growth”).
          </>,
          <>
            <Em>Use of funds:</Em> how the budget and each tranche will be spent.
          </>,
        ]}
      />
      <P>
        Replace every placeholder line of the template. A memo that still contains the template’s
        prompts tells backers you haven’t done the work.
      </P>

      <H2 id="demo">Watch the demo</H2>
      <P>A walkthrough of raising, launching and trading a verdict on Moneta.</P>
      <VideoFacade id={DEMO_VIDEO_ID} title="Moneta demo: raise, launch and trade a verdict" />
    </ArticleShell>
  );
}
