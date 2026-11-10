/**
 * Frontend hide list. Raises are permissionless, so anyone can publish a name and memo that would then
 * appear on this domain (impersonation, phishing, spam). The protocol stays permissionless; the website
 * curates: a hidden raise or treasury 404s and is left out of Explore, the home page, the sitemap and
 * share-card generation. Add lowercase raise or treasury addresses, then redeploy.
 * See docs/runbooks/seo.md.
 */
const HIDDEN: ReadonlySet<string> = new Set<string>([
  // "0x…",
]);

export function isHidden(address: string | null | undefined): boolean {
  return !!address && HIDDEN.has(address.toLowerCase());
}
