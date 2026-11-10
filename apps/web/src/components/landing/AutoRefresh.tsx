"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-pulls the server render on an interval while the tab is visible, so server-rendered figures stay
 * live without shipping data-fetching code to the browser. The route is ISR, so this reads the CDN
 * cache, not the indexer.
 */
export function AutoRefresh({ everyMs }: { everyMs: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, everyMs);
    return () => clearInterval(id);
  }, [router, everyMs]);
  return null;
}
