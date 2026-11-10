import type { MetadataRoute } from "next";
import { INDEXABLE_DEPLOYMENT, SITE_URL } from "@/lib/site";

/**
 * Crawl rules. Pages are kept out of the index with `noindex` (portfolio, propose forms, testnet on-chain
 * pages), never with Disallow: a disallowed URL can still be indexed from links, because the crawler
 * never sees its noindex. Never disallow /_next/ (Google needs the JS and CSS to render).
 * AI crawlers (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended) are allowed on purpose:
 * a new protocol wants to be explained and cited (seo.md §4.4).
 */
export default function robots(): MetadataRoute.Robots {
  if (!INDEXABLE_DEPLOYMENT) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Internal search results: infinite, thin URL space.
        disallow: ["/explore?q="],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
