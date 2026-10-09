import { explorerAddressUrl, FAUCETS } from "@moneta/sdk";
import { CircleHelp } from "lucide-react";
import Link from "next/link";
import { Wordmark } from "@/components/art/MonetaMark";
import { CHAIN, CHAIN_ID, deployment, IS_TESTNET } from "@/lib/env";

type Item = { label: string; href: string; external?: boolean };

const COLUMNS: { title: string; items: Item[] }[] = [
  {
    title: "Protocol",
    items: [
      { label: "Explore", href: "/explore" },
      { label: "Create a raise", href: "/create" },
      { label: "Portfolio", href: "/portfolio" },
      { label: "Docs", href: "/docs" },
    ],
  },
  {
    title: "Resources",
    items: [
      { label: "How verdicts work", href: "/docs#verdicts" },
      { label: "Architecture", href: "/docs#architecture" },
      { label: "Protocol status", href: "/status" },
      { label: "Security model", href: "/docs#security" },
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
      <div className="mx-auto grid max-w-[1200px] gap-12 px-4 py-16 sm:px-6 lg:grid-cols-4 xl:px-0">
        <div className="flex flex-col gap-4">
          <Wordmark />
          <p className="caption text-fg-3">
            © 2026 Moneta · Permissionless futarchy capital formation
          </p>
          <span className="inline-flex h-9 w-fit items-center rounded-[8px] border border-line px-3 body-sm text-fg-2">
            {CHAIN.name}
          </span>
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
