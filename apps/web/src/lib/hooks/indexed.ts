"use client";

import { useQuery } from "@tanstack/react-query";
import { indexer } from "@/lib/env";

/** Indexer-backed (DERIVED) data: lists, history, charts. Never gates or amounts. */

export function useProtocolStats() {
  return useQuery({
    queryKey: ["idx", "protocol"],
    queryFn: () => indexer.protocol(),
    refetchInterval: 5_000,
  });
}

export function useRaises() {
  return useQuery({
    queryKey: ["idx", "raises"],
    queryFn: () => indexer.raises({ limit: 200 }),
    refetchInterval: 5_000,
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ["idx", "projects"],
    queryFn: () => indexer.projects(200),
    refetchInterval: 5_000,
  });
}

export function useActiveProposals() {
  return useQuery({
    queryKey: ["idx", "active-proposals"],
    queryFn: () => indexer.activeProposals(50),
    refetchInterval: 4_000,
  });
}

export function useIndexerMeta() {
  return useQuery({
    queryKey: ["idx", "meta"],
    queryFn: () => indexer.meta(),
    refetchInterval: 3_000,
  });
}
