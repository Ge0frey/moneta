import type { ReactNode } from "react";
import { Nav } from "@/components/layout/Nav";
import { WalletButton } from "@/components/layout/Wallet";
import { CHAIN } from "@/lib/env";
import { Providers } from "./providers";

/** The app: wallet, chain reads and the indexer. Only these routes load the wallet stack. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <Nav
        networkName={CHAIN.name}
        action={<WalletButton />}
        mobileAction={<WalletButton block />}
      />
      <main id="main" className="min-h-[calc(100dvh-56px)]">
        {children}
      </main>
    </Providers>
  );
}
