import type { Metadata } from "next";
import { NotFoundContent } from "@/components/layout/NotFoundContent";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "This raise, treasury or proposal doesn't exist on Moneta.",
  robots: { index: false, follow: true },
};

/**
 * 404 for notFound() inside the app (an address the factory confirms isn't a raise or treasury). It
 * renders inside the app layout, so the wallet nav stays. The response is a real 404 with noindex; Next
 * paints this body client-side for notFound() thrown from these dynamic routes (the same as before).
 */
export default function AppNotFound() {
  return <NotFoundContent />;
}
