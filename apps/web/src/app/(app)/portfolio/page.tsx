import { Suspense } from "react";
import { Frame } from "@/components/layout/Frame";
import { Skeleton } from "@/components/ui/states";
import { pageMetadata } from "@/lib/seo";
import { PortfolioView } from "./PortfolioView";

/** Wallet-specific and empty without a connected wallet: kept out of the index, links still followed. */
export const metadata = pageMetadata({
  title: "Portfolio",
  description: "Your Moneta contributions, verdict positions and token holdings on Monad.",
  path: "/portfolio",
  noindex: true,
});

export default function PortfolioPage() {
  return (
    <Frame>
      <Suspense fallback={<Skeleton className="mt-12 h-[400px] w-full rounded-[16px]" />}>
        <PortfolioView />
      </Suspense>
    </Frame>
  );
}
