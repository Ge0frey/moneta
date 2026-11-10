/**
 * Site identity and indexing switches. Pure constants: safe to import from server and client code.
 */

/** Canonical origin. Override per environment (e.g. a future testnet host). `||`: an empty value counts as unset. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.monetafutarchy.xyz"
).replace(/\/$/, "");
export const SITE_HOST = new URL(SITE_URL).host.replace(/^www\./, "");
export const SITE_NAME = "Moneta";
export const SITE_TAGLINE = "Futarchy fundraising on Monad";

/** Home page <title> (absolute, no template) and the site-wide default description. */
export const HOME_TITLE = "Moneta — Futarchy Fundraising on Monad. Raise In Public.";
export const HOME_DESCRIPTION =
  "Raise a crypto startup's first round in public on Monad. One price for every backer, full refunds below the goal, and a treasury the market controls.";
/** The brand line used on share cards. */
export const CARD_TITLE = "Moneta — Raise In Public. Spend By Verdict.";

export const X_HANDLE = "@monetaxyz";
export const X_URL = "https://x.com/monetaxyz";
export const GITHUB_URL = "https://github.com/Ge0frey/moneta";
export const DEMO_VIDEO_ID = "jirW6oq9C9w";
export const SAME_AS = [X_URL, GITHUB_URL];

/**
 * Only the production deployment may be indexed. Vercel sets VERCEL_ENV (previews and local builds get a
 * blocking robots.txt). If the site is ever hosted outside Vercel, set NEXT_PUBLIC_SEO_ALLOW_INDEXING=true
 * on the production build, or robots.txt will block every crawler. NEXT_PUBLIC_SEO_BLOCK_INDEXING=true
 * blocks a whole host regardless (e.g. a testnet host once mainnet is live).
 */
export const INDEXABLE_DEPLOYMENT =
  process.env.NEXT_PUBLIC_SEO_BLOCK_INDEXING !== "true" &&
  (process.env.VERCEL_ENV === "production" ||
    process.env.NEXT_PUBLIC_SEO_ALLOW_INDEXING === "true");

/**
 * Index raise / project / proposal pages? Off while Moneta runs on testnet with demo data; turn on at
 * mainnet. Pages stay server-rendered (link previews) and crawlable (`follow`) either way.
 */
export const INDEX_ONCHAIN = process.env.NEXT_PUBLIC_SEO_INDEX_ONCHAIN === "true";
