import { ArticleShell } from "@/components/content/ArticleShell";
import { A, Em, H2, Note, P, UL } from "@/components/content/prose";
import { contentMetadata, contentPage } from "@/lib/content";
import { GITHUB_URL } from "@/lib/site";

const PATH = "/legal/risks";
export const metadata = contentMetadata(PATH);

export default function Page() {
  return (
    <ArticleShell
      page={contentPage(PATH)}
      crumbs={[]}
      schema="WebPage"
      lede={
        <p>
          Raising, backing and trading on Moneta carries real risk. This page states it plainly.
          Read it before you commit funds, and only commit what you can afford to lose.
        </p>
      }
      toc={[
        ["testnet", "Testnet status"],
        ["contracts", "Smart contracts"],
        ["markets", "Markets and verdicts"],
        ["founders", "Founder and project risk"],
        ["proposals", "Proposal risk"],
        ["stablecoins", "Stablecoins and the chain"],
        ["interface", "This website"],
        ["regulation", "Regulation and advice"],
      ]}
      related={[
        {
          href: "/docs#security",
          label: "Security model",
          sub: "What the contracts guarantee, and how.",
        },
        { href: "/faq", label: "FAQ", sub: "Short answers about raising, backing and trading." },
      ]}
    >
      <Note label="In one line">
        Moneta is experimental, unaudited software running on a test network. Anything you do here
        can lose value, and nothing here is advice.
      </Note>

      <H2 id="testnet">Testnet status</H2>
      <P>
        Moneta currently runs on <Em>Monad testnet</Em>. Testnet tokens, including Circle’s test
        USDC, Moneta’s mUSDC and every project token, have no monetary value. The projects listed
        today are test and demonstration raises. Testnet state can be reset, and testnet deployments
        may be abandoned when Moneta moves to mainnet.
      </P>

      <H2 id="contracts">Smart contracts</H2>
      <UL
        items={[
          <>
            <Em>No independent audit has been published.</Em> The contracts are{" "}
            <A href={GITHUB_URL}>open source</A> and tested (unit, invariant, adversarial and fork
            tests, plus static analysis), but tests can’t prove the absence of bugs.
          </>,
          <>
            <Em>Immutability cuts both ways.</Em> Nobody can change a deployed project’s rules or
            move its funds, which also means a bug in a deployed contract can’t be patched.
          </>,
          <>
            <Em>Composability.</Em> Moneta interacts with external contracts (the quote token, and
            whatever a passed arbitrary-call proposal targets), which carry their own risks.
          </>,
        ]}
      />

      <H2 id="markets">Markets and verdicts</H2>
      <UL
        items={[
          <>
            <Em>Prices can fall.</Em> A project token can trade well below its raise price, and
            conditional positions on the losing side of a verdict are worth nothing.
          </>,
          <>
            <Em>Thin markets can mislead.</Em> When few people trade, prices and verdicts may not
            reflect a project’s real prospects. Lagging TWAPs make manipulation expensive, not
            impossible.
          </>,
          <>
            <Em>Verdicts are final.</Em> Once a proposal passes and executes, the funds have moved.
          </>,
          <>
            <Em>Slippage and fees</Em> apply to every trade.
          </>,
        ]}
      />

      <H2 id="founders">Founder and project risk</H2>
      <P>
        A founder’s operating budget streams regardless of results until a redemption passes. A team
        can miss milestones, abandon a project or fail outright. Redemption lets holders recover
        their share of what’s left in the treasury, but only if a redemption proposal passes, and
        only what remains at that time.
      </P>

      <H2 id="proposals">Proposal risk</H2>
      <P>
        Proposals can transfer funds, mint tokens, change the budget or governance settings, change
        the founder, or make an <Em>arbitrary call</Em>, which does exactly what its calldata says
        once the market passes it. Read the memo and the decoded action before trading or relying on
        a market to stop a harmful proposal.
      </P>

      <H2 id="stablecoins">Stablecoins and the chain</H2>
      <UL
        items={[
          <>
            <Em>USDC can be frozen.</Em> Circle can freeze USDC held by specific addresses,
            including contracts.
          </>,
          <>
            <Em>Network risk.</Em> Moneta depends on Monad. Congestion, outages or consensus issues
            can delay transactions, finalization or execution.
          </>,
        ]}
      />

      <H2 id="interface">This website</H2>
      <P>
        This site is one interface to the contracts, not the contracts themselves. It can be
        unavailable, and lists and charts come from an indexer that can lag the chain. Every amount
        and gate you act on is read from the chain, but always check transactions in your wallet
        before signing. Raises are permissionless: a listing here is not an endorsement, and Moneta
        may hide raises from this site without affecting them on-chain.
      </P>

      <H2 id="regulation">Regulation and advice</H2>
      <P>
        Token sales and trading are regulated in many jurisdictions. You are responsible for
        complying with the laws that apply to you. Nothing on this site is investment, legal, tax or
        financial advice, and nothing here is an offer or solicitation to buy or sell any token.
      </P>
    </ArticleShell>
  );
}
