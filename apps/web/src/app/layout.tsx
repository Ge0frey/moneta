import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { IBM_Plex_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { Footer, HelpButton } from "@/components/layout/Footer";
import { Nav } from "@/components/layout/Nav";
import { Providers } from "./providers";
import "./globals.css";

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
});

const SITE_URL = "https://www.monetafutarchy.xyz";
const TITLE = "Moneta — Raise In Public. Spend By Verdict.";
const DESCRIPTION =
  "Permissionless futarchy capital formation on Monad. Every dollar leaves a project's treasury only when the market says it creates value.";

/** Link-preview card: 1200 × 628 (1.91:1) rendered at 2×, for X's summary_large_image and Open Graph. */
const SOCIAL_IMAGE = {
  url: "/og.png",
  width: 2400,
  height: 1256,
  alt: "Moneta — Raise In Public. Spend By Verdict. Permissionless futarchy on Monad.",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s · Moneta" },
  description: DESCRIPTION,
  icons: { icon: "/icon.svg" },
  openGraph: {
    type: "website",
    siteName: "Moneta",
    locale: "en_US",
    title: TITLE,
    description: DESCRIPTION,
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    site: "@monetaxyz",
    creator: "@monetaxyz",
    title: TITLE,
    description: DESCRIPTION,
    images: [SOCIAL_IMAGE],
  },
};

export const viewport: Viewport = { themeColor: "#000000", colorScheme: "dark" };

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
        <Providers>
          <Nav />
          <main id="main" className="min-h-[calc(100dvh-56px)]">
            {children}
          </main>
          <Footer />
          <HelpButton />
        </Providers>
      </body>
    </html>
  );
}
