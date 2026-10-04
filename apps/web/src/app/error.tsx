"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Frame } from "@/components/layout/Frame";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/pills";

/** Route-level error boundary: the layout (nav, wallet) stays usable; funds are never affected by a UI error. */
export default function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Frame variant="narrative">
      <section role="alert" className="flex flex-col items-start gap-5 py-24">
        <Eyebrow>Error</Eyebrow>
        <h1 className="heading-xl">This View Broke.</h1>
        <p className="body max-w-[56ch] text-fg-2">
          Something failed while rendering this page. Your funds are unaffected: everything lives
          on-chain, and nothing here can move it without your signature.
        </p>
        {error.digest && <p className="mono-xs text-fg-3">Reference {error.digest}</p>}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => retry()}>Try again</Button>
          <Button asChild variant="secondary">
            <Link href="/status">Check protocol status</Link>
          </Button>
        </div>
      </section>
    </Frame>
  );
}
