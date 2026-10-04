import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Frame, Section } from "@/components/layout/Frame";
import { AddressChip, PageHeader } from "@/components/ui/display";
import { Eyebrow } from "@/components/ui/pills";
import { CHAIN, deployment } from "@/lib/env";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "How Moneta works: permissionless raises, market-governed treasuries, decision markets and lagging-TWAP verdicts on Monad.",
};

const TOC = [
  ["overview", "Overview"],
  ["raises", "Raises"],
  ["launch", "Launch"],
  ["treasury", "Treasury"],
  ["verdicts", "Verdicts"],
  ["trading", "Trading a verdict"],
  ["redemption", "Redemption"],
  ["performance", "Performance package"],
  ["architecture", "Architecture"],
  ["security", "Security"],
] as const;

function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="heading-md scroll-mt-24 pt-14 first:pt-0">
      <a href={`#${id}`} className="hover:text-accent">
        {children}
      </a>
    </h2>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="body mt-4 max-w-[68ch] text-fg-2">{children}</p>;
}

function Formula({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <figure className="mt-5 rounded-[12px] border border-line bg-surface-1 px-5 py-4">
      <pre className="mono-md overflow-x-auto whitespace-pre text-fg">{children}</pre>
      {caption && <figcaption className="mono-xs mt-2 text-fg-3">{caption}</figcaption>}
    </figure>
  );
}

function Rows({ rows, head }: { rows: ReactNode[][]; head: string[] }) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[520px]">
        <thead>
          <tr className="mono-xs text-fg-3 uppercase">
            {head.map((h) => (
              <th key={h} className="py-2 pr-4 text-left font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line-strong align-top">
              {r.map((c, j) => (
                <td
                  key={j}
                  className={j === 0 ? "py-3 pr-4 body-sm text-fg" : "py-3 pr-4 body-sm text-fg-2"}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CONTRACTS: [string, keyof NonNullable<typeof deployment> | null, string][] = [
  [
    "MonetaFactory",
    "factory",
    "Registry and protocol config. Creates raises; launches projects from successful ones as deterministic clones.",
  ],
  [
    "Raise",
    "raiseImpl",
    "One escrow per raise: contributions, finalize (launch or fail), claims and refunds.",
  ],
  ["ProjectToken", "projectTokenImpl", "ERC-20 with EIP-2612 permit. Only its treasury can mint."],
  [
    "Treasury",
    "treasuryImpl",
    "Per-project custody and futarchy engine: proposals, verdicts, typed actions, budget, tranches, redemption.",
  ],
  [
    "ConditionalVault",
    "vault",
    "Splits collateral into PASS and FAIL tokens, then pays out the winning side after the verdict.",
  ],
  [
    "MonetaAMM",
    "amm",
    "Constant-product pools with a built-in lagging TWAP oracle. Treasury-owned liquidity only.",
  ],
  [
    "MonetaRouter",
    "router",
    "Stateless helper: buy or sell a verdict, merge, redeem, spot swaps. Holds nothing between transactions.",
  ],
];

export default function DocsPage() {
  return (
    <Frame variant="narrative">
      <PageHeader
        eyebrow={<Eyebrow className="w-fit">Docs</Eyebrow>}
        title="How Moneta Works."
        sub="Permissionless raises whose treasuries answer to markets. Every spend beyond a streamed budget is decided by comparing what traders think the token is worth if it passes against what they think it is worth if it fails."
      />
      <Section dense className="pb-28">
        <div className="grid gap-10 lg:grid-cols-4">
          <nav aria-label="On this page" className="lg:sticky lg:top-20 lg:self-start">
            <p className="mono-xs mb-3 text-fg-3 uppercase">On this page</p>
            <ol className="flex flex-wrap gap-x-4 gap-y-2 lg:flex-col">
              {TOC.map(([id, label], i) => (
                <li key={id}>
                  <a href={`#${id}`} className="body-sm text-fg-2 hover:text-fg">
                    <span className="mono-xs mr-2 text-fg-3">{String(i + 1).padStart(2, "0")}</span>
                    {label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <article className="lg:col-span-3">
            <H2 id="overview">Overview</H2>
            <P>
              A founder publishes a Raise Memo and fixed terms. Backers commit USDC during a fixed
              window. If the raise clears its minimum, one transaction launches the project: a
              token, protocol-owned liquidity, and a treasury that no person controls. The founder
              draws a streamed operating budget. Everything else (milestone tranches, transfers,
              mints, buybacks, config changes, even winding the project down) is a proposal, and
              each proposal is settled by a pair of decision markets.
            </P>
            <P>
              Contracts are immutable. Nobody, Moneta included, can change a project&apos;s rules
              after its raise, move its funds, or pause its markets.
            </P>

            <H2 id="raises">Raises</H2>
            <Rows
              head={["Rule", "What happens"]}
              rows={[
                [
                  "One price",
                  "Every backer pays the founder's fixed price per token. FDV follows from it; it is never set separately.",
                ],
                ["Below the minimum", "Every contribution is refunded in full. No fee is taken."],
                [
                  "Above the maximum",
                  "Contributions keep flowing until the window closes. Each backer is allocated contribution × max ÷ total, and the excess is refunded.",
                ],
                [
                  "Fixed window",
                  "Raises never close early at the maximum, so late backers aren't disadvantaged.",
                ],
                [
                  "Finalize",
                  "Anyone can finalize once the window ends. A keeper does it within seconds.",
                ],
                [
                  "Exit guarantee",
                  "If a raise still isn't finalized after its grace period, anyone can abort it and refunds open. Funds can't be trapped.",
                ],
                [
                  "Claims",
                  "Tokens and refunds are pulled by each backer, so one blocked address can't hold up anyone else.",
                ],
              ]}
            />

            <H2 id="launch">Launch</H2>
            <P>
              Finalizing a successful raise does all of this atomically. If any step fails, the
              whole launch rolls back and the escrow is untouched.
            </P>
            <Formula caption="Raise.finalize → Factory.launch → Treasury.launch">
              {`accepted   = min(total, max)
fee        = accepted × raise fee        → protocol
net        = accepted − fee              → treasury
liquidity  = net × liquidity share       paired with new tokens at the raise price
tranche_i  = treasury at launch × bps_i  fixed in USDC at launch`}
            </Formula>
            <P>
              The spot pool opens at exactly the raise price, owned by the treasury. Its trading
              fees accrue to the treasury as the only liquidity provider.
            </P>

            <H2 id="treasury">Treasury</H2>
            <P>USDC can leave a treasury in only these ways:</P>
            <Rows
              head={["Path", "Who triggers it"]}
              rows={[
                [
                  "Streamed budget",
                  "The founder claims what has accrued, per second, since the last claim.",
                ],
                [
                  "Passed proposal",
                  "Tranche release, transfer, buyback or arbitrary call, executed automatically after a PASS verdict.",
                ],
                [
                  "Bond refund",
                  "A proposer's bond is returned when their proposal passes. On FAIL the treasury keeps it.",
                ],
                [
                  "Redemption",
                  "After a passed redemption, holders burn tokens for a fixed pro-rata share.",
                ],
              ]}
            />
            <P>
              One proposal is live per project at a time, so proposals can&apos;t double-spend the
              treasury or move each other&apos;s prices. The one exception is a redemption, which
              can queue behind the live proposal and blocks new proposals until it has had its
              verdict.
            </P>

            <H2 id="verdicts">Verdicts</H2>
            <P>
              Each proposal moves part of the spot liquidity into two pools that open at the same
              price: PASS-{"{TOKEN}"} against PASS-USDC, and FAIL-{"{TOKEN}"} against FAIL-USDC. The
              PASS pool prices the token in the world where the proposal executes. The FAIL pool
              prices it in the world where it doesn&apos;t.
            </P>
            <P>
              Each pool keeps a <strong className="text-fg">lagging observation</strong> that moves
              toward the pool&apos;s spot price by at most a fixed step per second. The verdict
              compares time-weighted averages of those observations over the trading window, after a
              warm-up.
            </P>
            <Formula caption="Per pool, integrated exactly in closed form, so the result doesn't depend on when anyone cranks">
              {`observation(t) moves toward spot at ≤ maxStep per second
TWAP = ∫ observation dt over [tradingStart, tradingEnd] ÷ duration`}
            </Formula>
            <Formula caption="Threshold in basis points: 0 for tranche releases, +1% for other founder proposals, +3% for everyone else by default">
              {`PASS  ⇔  twapPass × 10,000 ≥ twapFail × (10,000 + threshold)`}
            </Formula>
            <P>
              Moving a verdict means holding a pool&apos;s price away from fair value for much of
              the window. The step cap limits how fast the observation can follow, and every
              arbitrageur profits by pushing it back. A last-second pump barely registers.
            </P>
            <P>
              Anyone can finalize once the window ends. Finalizing resolves the markets, returns the
              winning side&apos;s liquidity to the spot pool, settles the bond, and executes the
              action. If execution reverts, the verdict still stands, and anyone can retry until the
              execution grace period ends.
            </P>

            <H2 id="trading">Trading a verdict</H2>
            <P>
              Buying PASS with 10 USDC splits it into 10 PASS-USDC and 10 FAIL-USDC, then swaps the
              PASS-USDC for PASS-{"{TOKEN}"}. If the proposal passes, your PASS-{"{TOKEN}"} redeems
              1:1 for the token. If it fails, your FAIL-USDC redeems 1:1 for USDC and you get your
              10 USDC back.
              <strong className="text-fg">
                {" "}
                A bet in one world never risks your stake in the other.
              </strong>
            </P>
            <P>
              Selling reverses it and merges matched pairs back into USDC. After the verdict, one
              click redeems every winning position. Losing positions are worth nothing.
            </P>

            <H2 id="redemption">Redemption</H2>
            <P>
              If holders believe the treasury is worth more returned than spent, anyone can propose
              a redemption. If it passes, the budget stops, liquidity is pulled, treasury-held
              tokens are burned, and the remaining USDC is fixed against the token supply. Each
              holder then burns tokens for exactly their share. Claim order doesn&apos;t matter.
            </P>

            <H2 id="performance">Performance package</H2>
            <P>
              Founders can earn extra tokens only by creating value: each tranche mints once the
              spot TWAP holds at a multiple of the raise price (2×, 4×, 8×…) over an unlock window,
              after a cliff. Nothing is minted at launch.
            </P>

            <H2 id="architecture">Architecture</H2>
            <P>
              Every dollar sits in contracts. Each project gets its own escrow and treasury,
              deployed as minimal clones. The AMM, the conditional vault and the router are shared
              singletons. An indexer serves lists and history. Every gate and amount you act on is
              read straight from the chain.
            </P>
            <Rows
              head={["Contract", "Role", CHAIN.name]}
              rows={CONTRACTS.map(([name, key, role]) => [
                name,
                role,
                deployment && key ? (
                  <AddressChip key={name} address={deployment[key] as string} />
                ) : (
                  "Not deployed"
                ),
              ])}
            />
            <P>
              Monad produces a block every 300 ms and finalizes in about 600 ms. Block timestamps
              have one-second granularity, so oracles update at most once per second. Monad charges
              the gas limit rather than gas used, so every Moneta transaction is simulated first and
              sent with a limit of 1.15× its estimate.
            </P>

            <H2 id="security">Security</H2>
            <Rows
              head={["Guarantee", "How"]}
              rows={[
                [
                  "No upgrades",
                  "Every contract is immutable. New versions ship as a new factory; existing projects keep the rules they launched with.",
                ],
                [
                  "Admin can't touch funds",
                  "The protocol Safe can allowlist quote assets, set fees within hard caps, set bounds for new raises, and pause new raise creation. Nothing else.",
                ],
                [
                  "No trading pause",
                  "There is deliberately no swap pause. An admin who could freeze markets mid-window could swing a verdict.",
                ],
                [
                  "Exits always open",
                  "Refunds, claims, merges, conditional redemptions and NAV redemptions can't be blocked.",
                ],
                [
                  "Trusted spenders",
                  "Conditional tokens let only the AMM and router move them, and both only ever pull from the caller.",
                ],
                [
                  "Isolated custody",
                  "Each raise and each treasury is its own contract. A problem in one project can't reach another's funds.",
                ],
              ]}
            />
            <P>
              Known external risks: Circle can freeze USDC for specific addresses, and an
              arbitrary-call proposal does exactly what its calldata says once the market passes it.
              Read the memo and the decoded action before trading.
            </P>
            <p className="mono-xs mt-10 text-fg-3">
              Live state of the deployment:{" "}
              <Link href="/status" className="text-accent hover:text-accent-hover">
                Protocol status →
              </Link>
            </p>
          </article>
        </div>
      </Section>
    </Frame>
  );
}
