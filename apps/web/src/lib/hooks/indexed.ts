"use client";

import type { IndexedProject, IndexedRaise } from "@moneta/sdk";
import { useQuery } from "@tanstack/react-query";
import { indexer } from "@/lib/env";

/** Indexer-backed (DERIVED) data: lists, history, charts. Never gates or amounts. */

/**
 * How often indexer-backed views poll. Envio Cloud's development plan allows 100 GraphQL requests a minute
 * (`x-ratelimit-limit: 100;w=60`), so every page stays at a few requests a minute. A user's own transactions
 * still show up immediately: the tx pipeline refetches every ["idx", …] query once the indexer has the block.
 */
export const INDEXER_POLL_MS = 15_000;

export function useProtocolStats() {
  return useQuery({
    queryKey: ["idx", "protocol"],
    // No Protocol row until the first raise; react-query treats `undefined` data as an error.
    queryFn: async () => (await indexer.protocol()) ?? null,
    refetchInterval: INDEXER_POLL_MS,
  });
}

/** `initial`: the server-rendered list, so the first paint matches the HTML crawlers saw. */
export function useRaises(initial?: IndexedRaise[]) {
  return useQuery({
    queryKey: ["idx", "raises"],
    queryFn: () => indexer.raises({ limit: 200 }),
    refetchInterval: INDEXER_POLL_MS,
    initialData: initial,
  });
}

export function useProjects(initial?: IndexedProject[]) {
  return useQuery({
    queryKey: ["idx", "projects"],
    queryFn: () => indexer.projects(200),
    refetchInterval: INDEXER_POLL_MS,
    initialData: initial,
  });
}

export function useActiveProposals() {
  return useQuery({
    queryKey: ["idx", "active-proposals"],
    queryFn: () => indexer.activeProposals(50),
    refetchInterval: INDEXER_POLL_MS,
  });
}

export function useIndexerMeta() {
  return useQuery({
    queryKey: ["idx", "meta"],
    queryFn: () => indexer.meta(),
    refetchInterval: INDEXER_POLL_MS,
  });
}
