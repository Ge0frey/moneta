import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { IBM_Plex_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { Footer, HelpButton } from "@/components/layout/Footer";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";
import {
  CARD_TITLE,
  HOME_DESCRIPTION,
  HOME_TITLE,
  SITE_NAME,
  SITE_URL,
  X_HANDLE,
} from "@/lib/site";
import "./globals.css";

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
});

/**
 * Site-wide defaults only. Every page sets its own title, description, canonical and cards through
 * `pageMetadata()` (lib/seo.ts); nothing here may carry a page-specific value such as a canonical URL,
 * because any page that forgot to override it would inherit it.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: HOME_TITLE, template: `%s · ${SITE_NAME}` },
  description: HOME_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: CARD_TITLE,
    description: HOME_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    site: X_HANDLE,
    creator: X_HANDLE,
    title: CARD_TITLE,
    description: HOME_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
};

export const viewport: Viewport = { themeColor: "#000000", colorScheme: "dark" };

/**
 * Root: document, fonts, footer. The nav and <main> live in the route-group layouts: (site) for
 * marketing pages (no wallet stack), (app) for the app (wagmi + RainbowKit + React Query).
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${plexMono.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only z-[100] rounded-full bg-primary px-4 py-2 text-fg-inverse focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        {children}
        <Footer />
        <HelpButton />
        {/* Cookieless traffic analytics and real-user Core Web Vitals (enable both in the Vercel project). */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
