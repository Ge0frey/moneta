"use client";

import {
  decodeMonetaError,
  decodeRevertData,
  gasLimitFor,
  signPermit,
  type PermitArgs,
  type WriteRequest,
} from "@moneta/sdk";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  encodeFunctionData,
  erc20Abi,
  type Address,
  type PublicClient,
  type TransactionReceipt,
} from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import { CHAIN, CHAIN_ID, indexer } from "@/lib/env";
import { useToasts } from "@/lib/toasts";

type RunOptions = {
  title: string;
  request: WriteRequest;
  /** Wait for the indexer to reach the receipt block before refreshing derived views. */
  indexerSync?: boolean;
  onSuccess?: (receipt: TransactionReceipt) => void;
};

/**
 * The Moneta transaction pipeline:
 * connect/switch → simulate (errors before the wallet prompt) → estimate → limit = est × 1.15 (Monad charges the
 * gas LIMIT) → sign → receipt ("Confirmed") → finalized block ("Final") → invalidate chain reads → wait for indexer.
 */
export function useMonetaTx() {
  const publicClient = usePublicClient() as PublicClient | undefined;
  const { data: walletClient } = useWalletClient();
  const { address, chainId, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { openConnectModal } = useConnectModal();
  const queryClient = useQueryClient();
  const { push, update, dismiss } = useToasts();

  const ensureReady = useCallback(async () => {
    if (!isConnected || !address) {
      openConnectModal?.();
      return false;
    }
    if (chainId !== CHAIN_ID) {
      try {
        await switchChainAsync({ chainId: CHAIN.id });
      } catch {
        push({ state: "error", title: `Switch to ${CHAIN.name}`, detail: "Wrong network" });
        return false;
      }
    }
    return true;
  }, [isConnected, address, chainId, switchChainAsync, openConnectModal, push]);

  const waitFinal = useCallback(
    async (block: bigint, toastId: string) => {
      if (!publicClient) return;
      for (let i = 0; i < 20; i++) {
        try {
          const f = await publicClient.getBlock({ blockTag: "finalized" });
          if (f.number >= block) break;
        } catch {
          break;
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      update(toastId, { state: "final" });
    },
    [publicClient, update],
  );

  const run = useCallback(
    async ({
      title,
      request,
      indexerSync = true,
      onSuccess,
    }: RunOptions): Promise<TransactionReceipt | null> => {
      if (!(await ensureReady()) || !publicClient || !walletClient || !address) return null;
      const id = push({ state: "signing", title });
      const call = { ...request, account: address } as never;
      try {
        await publicClient.simulateContract(call);
        const estimate = await publicClient.estimateContractGas(call);
        const hash = await walletClient.writeContract({
          ...(call as object),
          chain: CHAIN,
          gas: gasLimitFor(estimate),
        } as never);
        update(id, { state: "pending", hash });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "reverted") {
          let detail = "Transaction reverted";
          try {
            await publicClient.call({
              account: address,
              to: request.address,
              data: encodeFunctionData(request as never),
              blockNumber: receipt.blockNumber,
            });
          } catch (e) {
            const data = (e as { data?: `0x${string}` }).data;
            detail = (data ? decodeRevertData(data) : decodeMonetaError(e)).message;
          }
          update(id, { state: "reverted", detail });
          return null;
        }
        update(id, { state: "confirmed" });
        await queryClient.invalidateQueries({ queryKey: ["chain"] });
        void waitFinal(receipt.blockNumber, id);
        onSuccess?.(receipt);
        if (indexerSync) {
          void indexer
            .waitForBlock(receipt.blockNumber, 10_000, 1_000)
            .then(() => queryClient.invalidateQueries({ queryKey: ["idx"] }));
        }
        return receipt;
      } catch (err) {
        const d = decodeMonetaError(err);
        if (d.code === "USER_REJECTED") dismiss(id);
        else update(id, { state: "error", detail: d.message });
        return null;
      }
    },
    [
      ensureReady,
      publicClient,
      walletClient,
      address,
      push,
      update,
      dismiss,
      queryClient,
      waitFinal,
    ],
  );

  /**
   * EIP-2612 permit if the token supports it (USDC: version "2"; ProjectToken: OZ "1"); returns null if the user
   * should fall back to an approve transaction.
   */
  const permit = useCallback(
    async (token: Address, spender: Address, value: bigint): Promise<PermitArgs | null> => {
      if (!publicClient || !walletClient || !address) return null;
      try {
        return await signPermit({
          publicClient,
          walletClient,
          account: address,
          token,
          spender,
          value,
        });
      } catch (err) {
        if (decodeMonetaError(err).code === "USER_REJECTED") throw err;
        return null;
      }
    },
    [publicClient, walletClient, address],
  );

  /** Approve `spender` if allowance is short (fallback path when permit isn't available). */
  const ensureAllowance = useCallback(
    async (token: Address, spender: Address, amount: bigint, label: string) => {
      if (!publicClient || !address) return false;
      const allowance = await publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, spender],
      });
      if (allowance >= amount) return true;
      const r = await run({
        title: `Approve ${label}`,
        request: {
          address: token,
          abi: erc20Abi as never,
          functionName: "approve",
          args: [spender, amount],
        },
        indexerSync: false,
      });
      return !!r;
    },
    [publicClient, address, run],
  );

  return { run, permit, ensureAllowance, ensureReady, address, isConnected };
}
