import type { Metadata } from "next";
import { LaunchApp } from "@/components/layout/LaunchApp";
import { Nav } from "@/components/layout/Nav";
import { NotFoundContent } from "@/components/layout/NotFoundContent";
import { CHAIN } from "@/lib/env";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "This page doesn't exist on Moneta.",
  robots: { index: false, follow: true },
};

/** Root 404 (unmatched URLs). It renders outside both route groups, so it brings its own nav. */
export default function NotFound() {
  return (
    <>
      <Nav networkName={CHAIN.name} action={<LaunchApp />} mobileAction={<LaunchApp block />} />
      <main id="main" className="min-h-[calc(100dvh-56px)]">
        <NotFoundContent />
      </main>
    </>
  );
}
