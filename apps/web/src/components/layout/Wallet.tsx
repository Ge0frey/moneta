"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { shortAddress } from "@moneta/sdk";
import { Button } from "@/components/ui/button";

/** Wallet button: violet when disconnected, address chip when connected. */
export function WalletButton({ block }: { block?: boolean }) {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        if (!ready) return <div aria-hidden className="h-8 w-[132px]" />;
        if (!account) {
          return (
            <Button
              variant="accent"
              size="sm"
              onClick={openConnectModal}
              className={block ? "w-full" : undefined}
            >
              Connect wallet
            </Button>
          );
        }
        if (chain?.unsupported) {
          return (
            <Button
              variant="tertiary"
              size="sm"
              onClick={openChainModal}
              className="border-fail/60 text-fail"
            >
              Wrong network
            </Button>
          );
        }
        return (
          <button
            type="button"
            onClick={openAccountModal}
            className="inline-flex h-8 items-center gap-2 rounded-full border border-line bg-surface-1 pr-3.5 pl-1.5 mono-sm text-fg transition-colors hover:border-line-strong"
          >
            <span
              aria-hidden
              className="size-5 rounded-full bg-[conic-gradient(from_180deg,#2b2b2b,#9d8cff,#2b2b2b)]"
            />
            {account.ensName ?? shortAddress(account.address)}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
