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

export const metadata: Metadata = {
  title: { default: "Moneta — Raise In Public. Spend By Verdict.", template: "%s · Moneta" },
  description:
    "Permissionless futarchy capital formation on Monad. Every dollar leaves a project's treasury only when the market says it creates value.",
  icons: { icon: "/icon.svg" },
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
