"use client";

import { TEST_QUOTE_MINT, TEST_QUOTE_SYMBOL, FAUCETS, isTestQuote, txs } from "@moneta/sdk";
import { useState } from "react";
import type { Address } from "viem";
import { cn } from "@/lib/cn";
import { deployment, IS_TESTNET } from "@/lib/env";
import { useMonetaTx } from "@/lib/hooks/tx";

const LINK = "mono-xs w-fit text-left text-accent hover:text-accent-hover";

/**
 * Where a wallet gets the quote a raise or market takes. The test quote (mUSDC) mints in one click, so it is
 * offered whenever a wallet is connected; Circle USDC comes from Circle's faucet, linked on testnet once the
 * balance is empty.
 */
export function QuoteFaucet({
  quote,
  balance,
  className,
}: {
  quote: Address;
  balance?: bigint;
  className?: string;
}) {
  if (isTestQuote(deployment, quote)) return <MintTestQuote quote={quote} className={className} />;
  if (!IS_TESTNET || balance === undefined || balance > 0n) return null;
  return (
    <a href={FAUCETS.usdc} target="_blank" rel="noreferrer" className={cn(LINK, className)}>
      Get testnet USDC (Circle faucet) ↗
    </a>
  );
}

export function MintTestQuote({ quote, className }: { quote: Address; className?: string }) {
  const tx = useMonetaTx();
  const [busy, setBusy] = useState(false);
  if (!tx.isConnected || !tx.address) return null;
  const amount = `${(TEST_QUOTE_MINT / 10n ** 6n).toLocaleString("en-US")} ${TEST_QUOTE_SYMBOL}`;
  return (
    <button
      type="button"
      disabled={busy}
      className={cn(LINK, "disabled:opacity-60", className)}
      onClick={async () => {
        setBusy(true);
        try {
          await tx.run({
            title: `Mint ${amount}`,
            request: txs.mintTestQuote(quote, tx.address!, TEST_QUOTE_MINT),
            indexerSync: false,
          });
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Minting…" : `Mint ${amount} (test funds) →`}
    </button>
  );
}
