"use client";

import {
  readBalances,
  readFactory,
  readProject,
  readProposal,
  readRaise,
  type ProjectView,
} from "@moneta/sdk";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Address, PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { requireDeployment } from "@/lib/env";

/**
 * Chain-authoritative reads: every gate, amount and verdict shown in the UI comes from here.
 * Query keys live under ["chain", …] so the tx pipeline can invalidate them after a receipt.
 */

function useClient(): PublicClient | undefined {
  return usePublicClient() as PublicClient | undefined;
}

/** Chain time (latest block timestamp) advanced locally each second — countdowns never trust the user's clock. */
export function useChainNow(): number | undefined {
  const client = useClient();
  const { data } = useQuery({
    queryKey: ["chain", "now"],
    enabled: !!client,
    refetchInterval: 5_000,
    queryFn: async () => {
      const block = await client!.getBlock({ blockTag: "latest" });
      return { chain: Number(block.timestamp), local: Math.floor(Date.now() / 1000) };
    },
  });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (!data) return undefined;
  void tick;
  return data.chain + (Math.floor(Date.now() / 1000) - data.local);
}

export function useFactoryState() {
  const client = useClient();
  return useQuery({
    queryKey: ["chain", "factory"],
    enabled: !!client,
    queryFn: () => readFactory(client!, requireDeployment()),
    staleTime: 30_000,
  });
}

export function useRaiseState(raise: Address | undefined, account?: Address) {
  const client = useClient();
  return useQuery({
    queryKey: ["chain", "raise", raise, account],
    enabled: !!client && !!raise,
    refetchInterval: 4_000,
    queryFn: () => readRaise(client!, raise!, account),
  });
}

export function useProjectState(treasury: Address | undefined) {
  const client = useClient();
  return useQuery({
    queryKey: ["chain", "project", treasury],
    enabled: !!client && !!treasury,
    refetchInterval: 4_000,
    queryFn: () => readProject(client!, requireDeployment(), treasury!),
  });
}

export function useProposalState(project: ProjectView | undefined, id: bigint | undefined) {
  const client = useClient();
  return useQuery({
    queryKey: ["chain", "proposal", project?.treasury, id?.toString()],
    enabled: !!client && !!project && id !== undefined,
    refetchInterval: 2_000,
    queryFn: () => readProposal(client!, requireDeployment(), project!, id!),
  });
}

export function useBalances(account: Address | undefined, tokens: (Address | undefined)[]) {
  const client = useClient();
  const list = tokens.filter((t): t is Address => !!t);
  return useQuery({
    queryKey: ["chain", "balances", account, ...list],
    enabled: !!client && !!account && list.length > 0,
    refetchInterval: 4_000,
    queryFn: () => readBalances(client!, account!, list),
  });
}
