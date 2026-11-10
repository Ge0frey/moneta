/**
 * Server-side reads for rendering and SEO (metadata, share cards, sitemap, first paint). Server-only: never
 * import this from a client component.
 *
 * - Indexer reads are cached across requests (`unstable_cache`), so crawler traffic can't spend the
 *   indexer's rate limit (Envio dev plan: 100 requests / 60 s). Errors are not cached, and the wrappers turn
 *   an indexer outage into `null`, so pages degrade to the client view instead of returning a 5xx.
 * - React `cache` dedupes reads shared by generateMetadata, the page and opengraph-image in one request.
 * - Nothing here gates an action: amounts and verdicts a user acts on still come from chain reads in the
 *   client views. This is the same DERIVED data the indexer already serves to the browser.
 *
 * Next 16 note: `unstable_cache` is superseded by `"use cache"` under Cache Components. Migrate both
 * together if `cacheComponents` is ever enabled.
 */
import { monetaFactoryAbi, type IndexedProject, type IndexedRaise } from "@moneta/sdk";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { createPublicClient, fallback, http, type Address } from "viem";
import { CHAIN, deployment, indexer, RPC_URLS } from "@/lib/env";
import { isHidden } from "@/lib/hidden";
import { buildListings, type Listing } from "@/lib/listing";

/** Seconds a cached indexer read is served before it is refreshed. */
const DETAIL_TTL = 120;
const LIST_TTL = 60;

async function safe<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

/**
 * Throws on a miss so `unstable_cache` never stores it (thrown results aren't cached): a raise created a
 * moment ago must not be remembered as missing for the cache lifetime. `safe` turns the throw into null.
 */
async function found<T>(v: Promise<T | null | undefined>): Promise<T> {
  const r = await v;
  if (r === null || r === undefined) throw new Error("not indexed");
  return r;
}

export type RaiseDetail = NonNullable<Awaited<ReturnType<typeof indexer.raise>>>;
export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof indexer.project>>>;
export type ProposalDetail = NonNullable<Awaited<ReturnType<typeof indexer.proposal>>>;
export type ProposalRow = Awaited<ReturnType<typeof indexer.proposals>>[number];

/** Indexed raise (with contribution history), or null when missing, hidden or the indexer is down. */
export const getRaise = cache(async (address: string): Promise<RaiseDetail | null> => {
  const id = address.toLowerCase();
  if (isHidden(id)) return null;
  const r = await safe(
    unstable_cache(() => found(indexer.raise(id)), ["idx-raise", id], { revalidate: DETAIL_TTL }),
  );
  return r && !isHidden(r.treasury) ? r : null;
});

export const getProject = cache(async (treasury: string): Promise<ProjectDetail | null> => {
  const id = treasury.toLowerCase();
  if (isHidden(id)) return null;
  const p = await safe(
    unstable_cache(() => found(indexer.project(id)), ["idx-project", id], {
      revalidate: DETAIL_TTL,
    }),
  );
  return p && !isHidden(p.raise_id) ? p : null;
});

export const getProposals = cache(async (treasury: string): Promise<ProposalRow[] | null> => {
  const id = treasury.toLowerCase();
  if (isHidden(id)) return null;
  return safe(
    unstable_cache(() => indexer.proposals(id), ["idx-proposals", id], { revalidate: DETAIL_TTL }),
  );
});

export const getProposal = cache(
  async (treasury: string, proposalId: string): Promise<ProposalDetail | null> => {
    const id = treasury.toLowerCase();
    if (isHidden(id)) return null;
    return safe(
      unstable_cache(
        () => found(indexer.proposal(id, BigInt(proposalId))),
        ["idx-proposal", id, proposalId],
        { revalidate: DETAIL_TTL },
      ),
    );
  },
);

export const getProtocol = cache(async () =>
  safe(unstable_cache(() => found(indexer.protocol()), ["idx-protocol"], { revalidate: LIST_TTL })),
);

/** Raw raise and project lists (the same queries Explore makes in the browser). null = indexer down. */
export const getIndexedLists = cache(
  async (): Promise<{ raises: IndexedRaise[]; projects: IndexedProject[] } | null> => {
    const data = await safe(
      unstable_cache(
        async (): Promise<[IndexedRaise[], IndexedProject[]]> =>
          Promise.all([indexer.raises({ limit: 200 }), indexer.projects(200)]),
        ["idx-listings"],
        { revalidate: LIST_TTL },
      ),
    );
    return data ? { raises: data[0], projects: data[1] } : null;
  },
);

/** Every listing (raise joined with its project), newest first, hidden ones removed. null = indexer down. */
export const getListings = cache(async (): Promise<Listing[] | null> => {
  const lists = await getIndexedLists();
  return lists ? buildListings(lists.raises, lists.projects) : null;
});

// ── on-chain existence (authoritative 404s) ─────────────────────────────────

const rpc = createPublicClient({
  chain: CHAIN,
  transport: fallback(
    (RPC_URLS.length ? RPC_URLS : CHAIN.rpcUrls.default.http).map((u) =>
      http(u, { retryCount: 1, timeout: 5_000 }),
    ),
  ),
});

async function factoryKnows(
  fn: "isRaise" | "isTreasury",
  address: string,
): Promise<boolean | null> {
  const factory = deployment?.factory;
  if (!factory) return null;
  return safe(
    unstable_cache(
      () =>
        rpc.readContract({
          address: factory,
          abi: monetaFactoryAbi,
          functionName: fn,
          args: [address as Address],
        }),
      ["chain-exists", fn, address.toLowerCase()],
      { revalidate: 60 },
    ),
  );
}

/**
 * Whether the factory registered this raise. true / false from the chain, null when the RPC is
 * unreachable. Only a confirmed `false` may 404: an indexer outage or lag must never hide a real raise.
 */
export const isRaiseOnChain = cache((address: string) => factoryKnows("isRaise", address));
export const isTreasuryOnChain = cache((address: string) => factoryKnows("isTreasury", address));
