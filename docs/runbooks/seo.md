# Runbook: SEO and share cards

How Moneta's search and link-preview setup works, the switches that control it, and what to do at mainnet. Paths are relative to `apps/web/src`.

## 0. What's in place

| Piece | Where |
|---|---|
| Per-page metadata: title, description, canonical, `og:url`, Open Graph and X cards | `lib/seo.ts` (`pageMetadata`); every page goes through it |
| Raise / project / proposal titles, descriptions and the indexing quality gate | `lib/seo-onchain.ts` |
| Server reads for SSR, metadata, cards and sitemap (cached, outage-safe) | `lib/server/data.ts` |
| Generated share cards (1200×630) | `lib/og.tsx` + `opengraph-image.tsx` in each route folder |
| `robots.txt`, `sitemap.xml`, `manifest.webmanifest`, `llms.txt` | `app/robots.ts`, `app/sitemap.ts`, `app/manifest.ts`, `app/llms.txt/route.ts` |
| JSON-LD (Organization, WebSite, Article, FAQPage, DefinedTermSet, BreadcrumbList) | `lib/structured-data.ts`, `components/seo/JsonLd.tsx` |
| Content pages (learn, guides, FAQ, glossary, about, risks) | `lib/content.ts` (registry) + `app/(site)/…` |
| Frontend hide list | `lib/hidden.ts` |
| Icons | `app/favicon.ico`, `app/icon.svg`, `app/apple-icon.png`, `public/icon-{192,512}.png` |

Route groups: `app/(site)` holds the marketing and reading pages, without the wallet providers, so they ship no wagmi/RainbowKit/viem. `app/(app)` holds the app. URLs are unaffected.

## 1. Switches

| Variable | Default | Effect |
|---|---|---|
| `NEXT_PUBLIC_SEO_INDEX_ONCHAIN` | `false` | `false`: raise, project and proposal pages are `noindex, follow` and stay out of the sitemap (testnet demo data). `true`: pages that pass the quality gate are indexed and listed |
| `NEXT_PUBLIC_SITE_URL` | `https://www.monetafutarchy.xyz` | Origin for canonicals, the sitemap and cards. Set it per host (e.g. a testnet subdomain) |
| `NEXT_PUBLIC_SEO_ALLOW_INDEXING` | unset | `robots.txt` allows crawling only when `VERCEL_ENV=production`. Set `true` only if production is ever hosted outside Vercel |
| `NEXT_PUBLIC_SEO_BLOCK_INDEXING` | unset | `true` serves `Disallow: /` on that host no matter what (e.g. a testnet host once mainnet is live) |

The quality gate (`raiseIndexable` and friends): the memo matches its on-chain hash, has at least 150 real words and none of the template's placeholder lines, the raise isn't failed, aborted or hidden, and it is at least 24 hours old. Proposals also need at least 80 memo words and not to be cancelled.

## 2. Hide an abusive raise

Raises are permissionless, so an impersonation or phishing raise can appear on this domain. The protocol stays permissionless; the website can refuse to show it:

1. Add the lowercase raise address **and** its treasury address (if launched) to `lib/hidden.ts`.
2. Deploy. Hidden pages return 404 and drop out of Explore, the home page, the sitemap and card generation.
3. In Search Console, use **Removals** for an urgent takedown of an already-indexed URL.

## 3. Add a content page

1. Add an entry to `LEARN` or `GUIDES` in `lib/content.ts` (title of 51 characters or fewer, so 60 with " · Moneta"; description of 160 or fewer).
2. Create `app/(site)/<path>/page.tsx` with `export const metadata = contentMetadata(PATH)` and the `ArticleShell` layout.
3. Copy an `opengraph-image.tsx` from a sibling folder and change the path.
4. Link it from at least one existing page and the footer if it's a main page. The sitemap and `llms.txt` pick it up automatically.
5. When a page's substance changes, bump its `updated` date (it feeds the sitemap `lastmod` and `dateModified`).

## 4. After each deploy

```bash
S=https://www.monetafutarchy.xyz
curl -s $S/robots.txt                                    # Allow + Sitemap line (production only)
curl -s $S/sitemap.xml | grep -c '<loc>'                 # all static + content pages
curl -s $S/docs | grep -o '<link rel="canonical"[^>]*>'
curl -s -A facebookexternalhit/1.1 $S/raise/<addr> | grep -o '<title>[^<]*</title>\|<meta property="og:[^>]*>'
curl -s -o /dev/null -w "%{http_code}\n" $S/raise/0x0000000000000000000000000000000000000001   # 404
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" $S/raise/<Checksummed-Addr>          # 308 → lowercase
```

Then paste a raise link into X, Discord and Telegram and check the card. Platforms cache cards: refresh with Facebook's Sharing Debugger, LinkedIn's Post Inspector or `@WebpageBot` on Telegram.

## 5. One-time setup (outside the repo)

1. **Google Search Console:** add a *Domain* property for `monetafutarchy.xyz` (DNS TXT record), then submit `https://www.monetafutarchy.xyz/sitemap.xml`.
2. **Bing Webmaster Tools:** import the property from Search Console and submit the sitemap. Bing's index feeds ChatGPT search and Copilot.
3. **Vercel:** enable **Web Analytics** and **Speed Insights** for the project (the components are already in the root layout).
4. **Domains:** in Vercel → Domains, make the apex redirect straight to `https://www.monetafutarchy.xyz` (308).

## 6. Mainnet checklist

1. Move testnet to its own host (e.g. `testnet.monetafutarchy.xyz`) with `NEXT_PUBLIC_SITE_URL` set to that host and `NEXT_PUBLIC_SEO_BLOCK_INDEXING=true`, so it serves `Disallow: /`. Testnet on-chain pages were never indexed, so nothing is lost when they stop resolving on `www`.
2. On the mainnet production build set `NEXT_PUBLIC_SEO_INDEX_ONCHAIN=true`.
3. Get the risk page (`/legal/risks`) reviewed by counsel, and add terms and privacy pages under `/legal`.
4. Resubmit the sitemap in Search Console and Bing.

## 7. Dependencies and known behavior

- **Indexer.** Server rendering, metadata and cards read the Envio indexer through `lib/server/data.ts`, cached for 60–120 s, so crawler traffic can't spend the dev plan's 100 requests / 60 s. If the indexer is down or expired, pages fall back to the client view (status 200, `noindex` because they have no data) and cards fall back to the brand card. Nothing returns 5xx. After an Envio renewal, update `NEXT_PUBLIC_INDEXER_URL` on Vercel and redeploy, as usual.
- **404s on app routes.** `notFound()` is called only when the factory confirms an address isn't a raise or treasury, so indexer lag never 404s a real raise. Next paints those 404 bodies client-side; the status is a real 404 with `noindex`.
- **New raises.** The create flow waits (up to 8 s) for the indexer before opening the new raise page, so its first server render, the one a founder shares, has the real title and card.
