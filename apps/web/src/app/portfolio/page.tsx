import type { Metadata } from "next";
import { Suspense } from "react";
import { Frame } from "@/components/layout/Frame";
import { Skeleton } from "@/components/ui/states";
import { PortfolioView } from "./PortfolioView";

export const metadata: Metadata = { title: "Portfolio" };

export default function PortfolioPage() {
  return (
    <Frame>
      <Suspense fallback={<Skeleton className="mt-12 h-[400px] w-full rounded-[16px]" />}>
        <PortfolioView />
      </Suspense>
    </Frame>
  );
}
