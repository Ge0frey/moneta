import type { MetadataRoute } from "next";
import { ALL_CONTENT } from "@/lib/content";
import { projectHref, proposalHref, raiseHref } from "@/lib/listing";
import { projectIndexable, proposalIndexable, raiseIndexable } from "@/lib/seo-onchain";
import { getListings, getProposals } from "@/lib/server/data";
import { INDEX_ONCHAIN, SITE_URL } from "@/lib/site";

/** Rebuilt at most hourly. Only canonical, indexable URLs belong here. */
export const revalidate = 3600;

const date = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fromSeconds = (s: string | number | null | undefined) =>
  s ? new Date(Number(s) * 1000) : undefined;

/**
 * `lastModified` is only set when it is true (content registry dates, on-chain event times); a blanket
 * "now" teaches search engines to ignore it. priority/changefreq are omitted (Google ignores them).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/` },
    { url: `${SITE_URL}/docs`, lastModified: date("2026-11-09") },
    { url: `${SITE_URL}/learn`, lastModified: date("2026-11-09") },
    ...ALL_CONTENT.map((p) => ({ url: `${SITE_URL}${p.path}`, lastModified: date(p.updated) })),
    { url: `${SITE_URL}/explore` },
    { url: `${SITE_URL}/create` },
    { url: `${SITE_URL}/status` },
  ];
  if (!INDEX_ONCHAIN) return pages;

  // On-chain pages: only those that pass the quality gate (seo.md §3.2). An indexer outage yields [].
  const listings = (await getListings()) ?? [];
  for (const l of listings) {
    if (!raiseIndexable(l.raise)) continue;
    pages.push({
      url: `${SITE_URL}${raiseHref(l.raise.address)}`,
      lastModified: fromSeconds(l.raise.createdAt),
    });
    const p = l.project;
    if (!p || !projectIndexable(p, l.raise)) continue;
    const proposals = (await getProposals(p.treasury)) ?? [];
    const latest = proposals.reduce(
      (t, pr) => Math.max(t, Number(pr.finalizedAt ?? pr.createdAt)),
      Number(p.launchedAt),
    );
    pages.push({ url: `${SITE_URL}${projectHref(p.treasury)}`, lastModified: fromSeconds(latest) });
    for (const pr of proposals) {
      if (!proposalIndexable(pr, p, l.raise)) continue;
      pages.push({
        url: `${SITE_URL}${proposalHref(p.treasury, pr.proposalId)}`,
        lastModified: fromSeconds(pr.finalizedAt ?? pr.createdAt),
      });
    }
  }
  return pages;
}
