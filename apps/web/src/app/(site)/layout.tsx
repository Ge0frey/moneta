import type { ReactNode } from "react";
import { LaunchApp } from "@/components/layout/LaunchApp";
import { Nav } from "@/components/layout/Nav";
import { CHAIN } from "@/lib/env";

/** Marketing and reading pages: no wallet providers, so no wagmi/RainbowKit/viem in their JavaScript. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Nav networkName={CHAIN.name} action={<LaunchApp />} mobileAction={<LaunchApp block />} />
      <main id="main" className="min-h-[calc(100dvh-56px)]">
        {children}
      </main>
    </>
  );
}
