import { explorerAddressUrl, FAUCETS } from "@moneta/sdk";
import { CircleHelp } from "lucide-react";
import Link from "next/link";
import { Wordmark } from "@/components/art/MonetaMark";
import { CHAIN, CHAIN_ID, deployment, IS_TESTNET } from "@/lib/env";
import { GITHUB_URL, X_URL } from "@/lib/site";

type Item = { label: string; href: string; external?: boolean };

const COLUMNS: { title: string; items: Item[] }[] = [
  {
    title: "Protocol",
    items: [
      { label: "Explore raises", href: "/explore" },
      { label: "Create a raise", href: "/create" },
      { label: "Portfolio", href: "/portfolio" },
      { label: "How Moneta works", href: "/docs" },
      { label: "Protocol status", href: "/status" },
    ],
  },
  {
    title: "Learn",
    items: [
      { label: "What is futarchy?", href: "/learn/what-is-futarchy" },
      { label: "Decision markets", href: "/learn/decision-markets" },
      { label: "Futarchy vs token voting", href: "/learn/futarchy-vs-token-voting" },
      { label: "Raise vs launchpad vs VC", href: "/learn/futarchy-raise-vs-launchpad" },
      { label: "Glossary", href: "/glossary" },
    ],
  },
  {
    title: "Guides",
    items: [
      { label: "For founders", href: "/founders" },
      { label: "For backers", href: "/backers" },
      { label: "FAQ", href: "/faq" },
      { label: "Security model", href: "/docs#security" },
      { label: "Risks", href: "/legal/risks" },
      { label: "About", href: "/about" },
    ],
  },
  {
    title: "Network",
    items: [
      { label: CHAIN.name, href: "/status" },
      ...(IS_TESTNET
        ? [
            { label: "MON faucet", href: FAUCETS.mon, external: true },
            { label: "USDC faucet", href: FAUCETS.usdc, external: true },
          ]
        : []),
      ...(deployment?.testQuote
        ? [{ label: "mUSDC test funds", href: "/portfolio#test-funds" }]
        : []),
      ...(deployment && explorerAddressUrl(CHAIN_ID, deployment.factory)
        ? [
            {
              label: "Explorer",
              href: explorerAddressUrl(CHAIN_ID, deployment.factory)!,
              external: true,
            },
          ]
        : []),
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line-subtle bg-surface-1">
      <div className="mx-auto grid max-w-[1200px] gap-12 px-4 py-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-5 xl:px-0">
        <div className="flex flex-col gap-4">
          <Wordmark />
          <p className="caption text-fg-3">© 2026 Moneta · Futarchy fundraising on Monad</p>
          <span className="inline-flex h-9 w-fit items-center rounded-[8px] border border-line px-3 body-sm text-fg-2">
            {CHAIN.name}
          </span>
          <div className="flex gap-4">
            <a href={X_URL} rel="me noopener" className="body-sm text-fg-2 hover:text-fg">
              X ↗
            </a>
            <a href={GITHUB_URL} rel="me noopener" className="body-sm text-fg-2 hover:text-fg">
              GitHub ↗
            </a>
          </div>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title} className="flex flex-col gap-3">
            <h2 className="text-[15px] font-medium text-fg">{col.title}</h2>
            {col.items.map((i) =>
              i.external ? (
                <a
                  key={i.label}
                  href={i.href}
                  target="_blank"
                  rel="noreferrer"
                  className="body-sm w-fit text-fg-2 hover:text-fg"
                >
                  {i.label} ↗
                </a>
              ) : (
                <Link key={i.label} href={i.href} className="body-sm w-fit text-fg-2 hover:text-fg">
                  {i.label}
                </Link>
              ),
            )}
          </nav>
        ))}
      </div>
    </footer>
  );
}

/** Floating help button. */
export function HelpButton() {
  return (
    <Link
      href="/docs"
      aria-label="Help and docs"
      className="fixed right-4 bottom-4 z-40 grid size-10 place-items-center rounded-full border border-line bg-surface-1 text-fg-2 transition-colors hover:border-line-strong hover:text-fg sm:right-6 sm:bottom-6"
    >
      <CircleHelp className="size-5" aria-hidden />
    </Link>
  );
}
