import type { Metadata } from "next";
import { Suspense } from "react";
import { Frame } from "@/components/layout/Frame";
import { Skeleton } from "@/components/ui/states";
import { ExploreView } from "./ExploreView";

export const metadata: Metadata = { title: "Explore Raises" };

export default function ExplorePage() {
  return (
    <Frame>
      <Suspense fallback={<Skeleton className="mt-12 h-[400px] w-full rounded-[16px]" />}>
        <ExploreView />
      </Suspense>
    </Frame>
  );
}
