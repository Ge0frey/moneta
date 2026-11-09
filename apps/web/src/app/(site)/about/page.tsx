import { ArticleShell } from "@/components/content/ArticleShell";
import { A, Em, H2, P, UL } from "@/components/content/prose";
import { contentMetadata, contentPage } from "@/lib/content";
import { GITHUB_URL, X_URL } from "@/lib/site";

const PATH = "/about";
export const metadata = contentMetadata(PATH);

export default function Page() {
  return (
    <ArticleShell
      page={contentPage(PATH)}
      crumbs={[]}
      schema="WebPage"
      lede={
        <p>
          Moneta is futarchy fundraising on Monad. Founders raise in public, and every dollar beyond
          a streamed budget leaves a project’s treasury only when the market says it creates value.
        </p>
      }
      toc={[
        ["why", "Why Moneta exists"],
        ["name", "The name"],
        ["principles", "Principles"],
        ["status", "Where it stands"],
        ["contact", "Contact"],
      ]}
      related={[
        {
          href: "/docs",
          label: "How Moneta works",
          sub: "The full rules, formulas and contract map.",
        },
        {
          href: "/legal/risks",
          label: "Know the risks",
          sub: "What can go wrong, stated plainly.",
        },
      ]}
    >
      <H2 id="why">Why Moneta exists</H2>
      <P>
        A crypto founder raising a first round has two options today, and both are broken. Venture
        capital is slow, private and gated by who you know; the community gets in only at launch.
        Token launchpads are fast but built for hype; once the money lands, nothing holds the
        founder to the plan, and backers can only sell. Neither ties the money to the work.
      </P>
      <P>
        Moneta lets anyone raise in public, then puts the treasury under the control of the market
        instead of the founder. That is futarchy: instead of voting on what to do, people bet on
        what will work, and the bet decides. Read{" "}
        <A href="/learn/what-is-futarchy">what futarchy is</A>.
      </P>

      <H2 id="name">The name</H2>
      <P>
        Rome minted its coins at the temple of Juno Moneta on the Capitoline, and the words{" "}
        <Em>money</Em> and <Em>mint</Em> both come from her name. The name is traced to the Latin{" "}
        <em>monēre</em>, to warn or advise. Moneta is a mint that takes advice: capital moves only
        when the market says it should.
      </P>

      <H2 id="principles">Principles</H2>
      <UL
        items={[
          <>
            <Em>Immutable.</Em> Contracts can’t be upgraded. New versions ship as a new factory;
            existing projects keep the rules they launched with.
          </>,
          <>
            <Em>No one touches the funds.</Em> The protocol admin can set bounds and fees for future
            raises within hard caps. It can’t move money, change a live project’s rules or pause
            trading.
          </>,
          <>
            <Em>Exits always open.</Em> Refunds, claims and redemptions can’t be blocked.
          </>,
          <>
            <Em>Permissionless.</Em> No allowlist for founders, backers or traders.
          </>,
          <>
            <Em>Open source.</Em> Every contract, the indexer and this app are{" "}
            <A href={GITHUB_URL}>on GitHub</A>, with design decisions recorded as ADRs.
          </>,
        ]}
      />

      <H2 id="status">Where it stands</H2>
      <P>
        Moneta started at the Monad Metropolis hackathon, in the Onchain Finance &amp; Trading
        track. It runs on Monad testnet today, with Circle’s test USDC and Moneta’s mUSDC test
        token. It is built with Monad, Circle USDC, Envio HyperIndex, Safe, Foundry, OpenZeppelin,
        viem and wagmi. Live contract addresses and parameters are on the{" "}
        <A href="/status">status page</A>.
      </P>

      <H2 id="contact">Contact</H2>
      <P>
        Follow updates on <A href={X_URL}>X (@monetaxyz)</A>. Report bugs or propose changes through{" "}
        <A href={`${GITHUB_URL}/issues`}>GitHub issues</A>.
      </P>
    </ArticleShell>
  );
}
