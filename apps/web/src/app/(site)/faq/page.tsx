import { ArticleShell } from "@/components/content/ArticleShell";
import { H2 } from "@/components/content/prose";
import { contentMetadata, contentPage } from "@/lib/content";
import { faqPage } from "@/lib/structured-data";

const PATH = "/faq";
export const metadata = contentMetadata(PATH);

/**
 * Answers are plain strings so the same text feeds the page and the FAQPage JSON-LD (Google limits FAQ
 * rich results to authoritative government and health sites, but Bing and AI answer engines use it).
 */
const GROUPS: { id: string; title: string; items: { q: string; a: string }[] }[] = [
  {
    id: "basics",
    title: "Basics",
    items: [
      {
        q: "What is Moneta?",
        a: "Moneta is futarchy fundraising on Monad. Founders raise their first round in public at one price for everyone. A successful raise launches a token, a market and a treasury that no person controls. The founder draws a streamed budget, and every other dollar moves only when a pair of decision markets says the spend makes the token worth more.",
      },
      {
        q: "What is futarchy?",
        a: "A way to make decisions with markets instead of votes. For each proposal, one market prices the token if the proposal passes and another if it fails. The proposal executes only if the PASS price is higher, by a preset threshold, over a multi-day window.",
      },
      {
        q: "Is Moneta live?",
        a: "Moneta runs on Monad testnet. Test tokens have no value: use Circle's test USDC from its faucet, or Moneta's mUSDC test token, which you can mint from the Portfolio page.",
      },
      {
        q: "Who controls a project's treasury?",
        a: "No person. The treasury is an immutable contract. The founder can only claim the streamed operating budget. Every other payment, from milestone tranches to buybacks, executes only after a proposal passes its decision markets.",
      },
    ],
  },
  {
    id: "raises",
    title: "Raises",
    items: [
      {
        q: "Does every backer pay the same price?",
        a: "Yes. Every backer pays the founder's fixed price per token. The valuation follows from that price; it is never set separately.",
      },
      {
        q: "What happens if a raise misses its minimum?",
        a: "Every contribution is refunded in full, and no fee is taken. Each backer claims their own refund.",
      },
      {
        q: "What happens if a raise is oversubscribed?",
        a: "Contributions keep flowing until the window closes; raises never close early. Each backer is then allocated their contribution times the maximum divided by the total, and the excess is refunded.",
      },
      {
        q: "Who finalizes a raise?",
        a: "Anyone can finalize once the window ends, and a keeper usually does it within seconds. If a raise still isn't finalized after its grace period, anyone can abort it and refunds open, so funds can't be trapped.",
      },
    ],
  },
  {
    id: "proposals",
    title: "Proposals and verdicts",
    items: [
      {
        q: "Who can make a proposal?",
        a: "Anyone. Proposers post the project's USDC bond, which is returned if the proposal passes and kept by the treasury if it fails. Only one proposal is live per project at a time, so proposals can't double-spend the treasury.",
      },
      {
        q: "How is a verdict decided?",
        a: "Each proposal opens a PASS pool and a FAIL pool at the same price. Each pool keeps a lagging observation of its price, and after a warm-up the verdict compares their time-weighted averages: PASS wins if the PASS average beats the FAIL average by the threshold, which defaults to 0 for tranche releases, 1% for other founder proposals and 3% for everyone else.",
      },
      {
        q: "Can a whale or a last-minute trade swing a verdict?",
        a: "Not cheaply. The observation each verdict uses can move only a small step per second, so a last-second pump barely registers. Holding a price away from fair value for much of a multi-day window means paying every arbitrageur who pushes it back.",
      },
      {
        q: "What if a passed proposal fails to execute?",
        a: "The verdict still stands, and anyone can retry the execution until the execution grace period ends.",
      },
    ],
  },
  {
    id: "trading",
    title: "Trading",
    items: [
      {
        q: "How do I bet on a proposal?",
        a: "Buy PASS if you think the proposal makes the token worth more, FAIL if you think it doesn't. Buying PASS with 10 USDC splits it into 10 PASS-USDC and 10 FAIL-USDC and swaps the PASS-USDC for PASS-tokens. A bet in one world never risks your stake in the other.",
      },
      {
        q: "What happens to my position after the verdict?",
        a: "Winning positions redeem 1:1 for the real token or USDC, in one click. Losing positions are worth nothing, but if the world you bet on didn't happen, your matching USDC from the split comes back.",
      },
    ],
  },
  {
    id: "safety",
    title: "Safety and fees",
    items: [
      {
        q: "Can Moneta change a project's rules or move its funds?",
        a: "No. Every contract is immutable. The protocol's admin can only allowlist quote assets, set fees within hard caps, set bounds for new raises and pause new raise creation. It cannot move funds, change a live project's rules or pause trading.",
      },
      {
        q: "Can I always get my money out?",
        a: "Refunds, claims, merges, conditional redemptions and treasury redemptions can't be blocked by anyone. One external risk remains: Circle can freeze USDC for specific addresses.",
      },
      {
        q: "What does Moneta charge?",
        a: "A protocol fee on the amount a successful raise accepts, shown in each raise's terms and capped in the contracts. Failed raises are refunded in full with no fee. Trading fees in a project's pools go to that project's treasury, its only liquidity provider.",
      },
      {
        q: "Has Moneta been audited?",
        a: "No independent audit has been published. The contracts are open source and covered by unit, invariant, adversarial and fork tests plus static analysis. Moneta currently runs on testnet only.",
      },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.items);

export default function Page() {
  return (
    <ArticleShell
      page={contentPage(PATH)}
      crumbs={[]}
      schema="WebPage"
      lede={
        <p>
          Short answers about raising, backing and trading on Moneta. For the full rules, see the
          docs.
        </p>
      }
      toc={GROUPS.map((g) => [g.id, g.title])}
      related={[
        {
          href: "/docs",
          label: "How Moneta works",
          sub: "The complete rules, formulas and contract map.",
        },
        {
          href: "/glossary",
          label: "Glossary",
          sub: "Every Moneta and futarchy term in one place.",
        },
      ]}
      extraJsonLd={[faqPage(ALL)]}
    >
      {GROUPS.map((g) => (
        <section key={g.id} aria-labelledby={g.id}>
          <H2 id={g.id}>{g.title}</H2>
          <dl className="mt-5 flex max-w-[68ch] flex-col gap-7">
            {g.items.map(({ q, a }) => (
              <div key={q}>
                <dt className="heading-sm">{q}</dt>
                <dd className="body mt-2 text-fg-2">{a}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </ArticleShell>
  );
}
