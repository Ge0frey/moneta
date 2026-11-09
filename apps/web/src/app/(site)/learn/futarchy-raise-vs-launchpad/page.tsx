import { ArticleShell } from "@/components/content/ArticleShell";
import { A, Em, H2, Note, P, Table, UL } from "@/components/content/prose";
import { contentMetadata, contentPage } from "@/lib/content";

const PATH = "/learn/futarchy-raise-vs-launchpad";
export const metadata = contentMetadata(PATH);

export default function Page() {
  return (
    <ArticleShell
      page={contentPage(PATH)}
      crumbs={[{ name: "Learn", path: "/learn" }]}
      lede={
        <p>
          A crypto team with a product and a community has five ways to raise a first round. They
          differ in who gets access, how fast it is, and above all in what happens to the money
          after it lands.
        </p>
      }
      toc={[
        ["options", "The five options"],
        ["after", "What happens after the raise"],
        ["fit", "When each one fits"],
        ["moneta", "What a Moneta raise looks like"],
        ["tradeoffs", "The founder’s tradeoffs"],
      ]}
      related={[
        {
          href: "/founders",
          label: "Founder guide",
          sub: "Terms you set, what you get, and how to write a memo backers can price.",
        },
        {
          href: "/learn/what-is-futarchy",
          label: "What is futarchy?",
          sub: "Why a market, not a vote or a multisig, should release the money.",
        },
      ]}
      cta={{
        href: "/create",
        label: "Create a raise",
        secondary: { href: "/founders", label: "Founder guide" },
      }}
    >
      <H2 id="options">The five options</H2>
      <Table
        head={["Path", "Good at", "What breaks"]}
        rows={[
          [
            "Grants and ecosystem programs",
            "Non-dilutive money for early or public-good work",
            "Small, slow and discretionary; not built for a seven-figure build",
          ],
          [
            "VCs and accelerators",
            "Large cheques, advice, networks",
            "Access depends on who you know; terms are private; the community often gets in only at launch",
          ],
          [
            "Token launchpads",
            "Launching a tradable token fast",
            "No treasury, budget or milestone plan; backers’ only recourse is to sell",
          ],
          [
            "A plain public sale (ICO)",
            "Open access, one price",
            "The founder receives everything at once; nothing ties the money to delivery",
          ],
          [
            "A futarchy raise (Moneta)",
            "Open access, one price, refunds, a liquid token from day one",
            "The founder doesn’t control the treasury; spending beyond the budget needs a PASS verdict",
          ],
        ]}
      />

      <H2 id="after">What happens after the raise</H2>
      <P>
        Most fundraising debates focus on access and price. The bigger difference is what happens
        next. In almost every path, once the money arrives, nothing ties its release to the creation
        of value. Backers either trust the team completely (a public sale) or insist on a private,
        gated process (venture). Good founders can’t raise credibly in public, and backers can’t
        protect themselves once the money is sent.
      </P>
      <Note label="The missing piece">
        What’s missing isn’t another way to sell tokens. It’s <Em>accountable capital</Em>: money
        raised in public whose spending is governed by something better than founder discretion or a
        token vote.
      </Note>

      <H2 id="fit">When each one fits</H2>
      <UL
        items={[
          <>
            <Em>Grants</Em> fit public goods and early experiments that don’t need a token.
          </>,
          <>
            <Em>Venture</Em> fits teams that want a few large, hands-on investors and are
            comfortable with private terms.
          </>,
          <>
            <Em>Launchpads</Em> fit tokens whose whole point is the community around them, with no
            multi-year build to fund.
          </>,
          <>
            <Em>A futarchy raise</Em> fits teams with a working product, a community that wants in,
            and a plan that needs funding over milestones, who would rather earn trust in public
            than through introductions.
          </>,
        ]}
      />

      <H2 id="moneta">What a Moneta raise looks like</H2>
      <UL
        items={[
          <>The founder publishes a Raise Memo and fixed terms: price, minimum, maximum, window.</>,
          <>Every backer pays the same price. Below the minimum, everyone is refunded in full.</>,
          <>
            Above the maximum, contributions keep flowing until the window closes and each backer is
            allocated pro-rata, with the excess refunded. Raises never close early.
          </>,
          <>
            A successful raise launches the token, a spot market seeded at the raise price, and a
            treasury no person controls, in one transaction.
          </>,
          <>
            The founder draws a budget streamed by the second. Milestone tranches and every other
            spend need a PASS verdict from a pair of decision markets.
          </>,
          <>
            If the team stalls, anyone can propose a redemption. If it passes, holders exit at their
            exact share of the treasury.
          </>,
        ]}
      />

      <H2 id="tradeoffs">The founder’s tradeoffs</H2>
      <P>
        You give up control of the treasury. In return you raise without a gatekeeper, at a price
        you set, from the people who already use your product; you get a predictable budget from day
        one; and your backers become a liquid community with a reason to want you to succeed. An
        optional performance package mints extra tokens to the team only when the token holds at a
        multiple of the raise price, such as 2×, 4× or 8×.
      </P>
      <P>
        Ready to look closer? Start with the <A href="/founders">founder guide</A> or{" "}
        <A href="/explore">see how other teams set their terms</A>.
      </P>
    </ArticleShell>
  );
}
