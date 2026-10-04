import {
  erc20Abi,
  type Abi,
  type Account,
  type Address,
  type Chain,
  type Hash,
  type PublicClient,
  type TransactionReceipt,
  type WalletClient,
} from "viem";
import type { DeploymentRecord } from "./addresses";
import { encodeAction, type ProposalAction } from "./actions";
import { decodeMonetaError, decodeRevertData } from "./errors";
import {
  monetaAmmAbi,
  monetaFactoryAbi,
  monetaRouterAbi,
  raiseAbi,
  treasuryAbi,
} from "./generated/abis";
import { NO_PERMIT, type PermitArgs, type RaiseParams } from "./types";

/**
 * Transaction request builders — plain { address, abi, functionName, args } objects usable with wagmi
 * (simulateContract/writeContract) and with viem wallet clients (bots), so every layer sends identical calls.
 */
export type WriteRequest = {
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
};

const req = (
  address: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[],
): WriteRequest => ({
  address,
  abi,
  functionName,
  args,
});

export const txs = {
  approve: (token: Address, spender: Address, amount: bigint) =>
    req(token, erc20Abi as Abi, "approve", [spender, amount]),

  createRaise: (d: DeploymentRecord, p: RaiseParams, memo: string) =>
    req(d.factory, monetaFactoryAbi as Abi, "createRaise", [p, memo]),

  contribute: (raise: Address, amount: bigint) =>
    req(raise, raiseAbi as Abi, "contribute", [amount]),
  contributeWithPermit: (raise: Address, amount: bigint, p: PermitArgs) =>
    req(raise, raiseAbi as Abi, "contributeWithPermit", [amount, p.deadline, p.v, p.r, p.s]),
  finalizeRaise: (raise: Address) => req(raise, raiseAbi as Abi, "finalize", []),
  abortRaise: (raise: Address) => req(raise, raiseAbi as Abi, "abort", []),
  claim: (raise: Address) => req(raise, raiseAbi as Abi, "claim", []),

  propose: (
    treasury: Address,
    action: ProposalAction,
    memo: string,
    bondPermit: PermitArgs = NO_PERMIT,
  ) => {
    const { actionType, data } = encodeAction(action);
    return req(treasury, treasuryAbi as Abi, "propose", [actionType, data, memo, bondPermit]);
  },
  finalizeProposal: (treasury: Address, id: bigint) =>
    req(treasury, treasuryAbi as Abi, "finalizeProposal", [id]),
  executeProposal: (treasury: Address, id: bigint) =>
    req(treasury, treasuryAbi as Abi, "executeProposal", [id]),
  claimBudget: (treasury: Address) => req(treasury, treasuryAbi as Abi, "claimBudget", []),
  redeem: (treasury: Address, amount: bigint) =>
    req(treasury, treasuryAbi as Abi, "redeem", [amount]),
  startPerformanceUnlock: (treasury: Address, index: number) =>
    req(treasury, treasuryAbi as Abi, "startPerformanceUnlock", [index]),
  completePerformanceUnlock: (treasury: Address, index: number) =>
    req(treasury, treasuryAbi as Abi, "completePerformanceUnlock", [index]),

  buyOutcome: (
    d: DeploymentRecord,
    treasury: Address,
    id: bigint,
    pass: boolean,
    quoteIn: bigint,
    minOut: bigint,
    permit: PermitArgs = NO_PERMIT,
  ) =>
    req(d.router, monetaRouterAbi as Abi, "buyOutcome", [
      treasury,
      id,
      pass,
      quoteIn,
      minOut,
      permit,
    ]),
  sellOutcome: (
    d: DeploymentRecord,
    treasury: Address,
    id: bigint,
    pass: boolean,
    tokenIn: bigint,
    minQuoteOut: bigint,
  ) =>
    req(d.router, monetaRouterAbi as Abi, "sellOutcome", [
      treasury,
      id,
      pass,
      tokenIn,
      minQuoteOut,
    ]),
  mergeAll: (d: DeploymentRecord, treasury: Address, id: bigint) =>
    req(d.router, monetaRouterAbi as Abi, "mergeAll", [treasury, id]),
  redeemAll: (d: DeploymentRecord, treasury: Address, id: bigint) =>
    req(d.router, monetaRouterAbi as Abi, "redeemAll", [treasury, id]),
  swapSpot: (
    d: DeploymentRecord,
    treasury: Address,
    buy: boolean,
    amountIn: bigint,
    minOut: bigint,
    permit: PermitArgs = NO_PERMIT,
  ) => req(d.router, monetaRouterAbi as Abi, "swapSpot", [treasury, buy, amountIn, minOut, permit]),

  crank: (d: DeploymentRecord, poolId: bigint) =>
    req(d.amm, monetaAmmAbi as Abi, "crank", [poolId]),
};

/**
 * Gas policy: Monad charges the gas LIMIT, so we never use wallet defaults. limit = estimate × 1.15.
 * Ceilings below are 2× the EVM-measured budgets (GasBudgets.t.sol) to absorb Monad's cold-access repricing; an
 * estimate above its ceiling is surfaced as a warning, never silently truncated.
 */
export const GAS_CEILINGS: Record<string, bigint> = {
  createRaise: 5_000_000n,
  contribute: 400_000n,
  contributeWithPermit: 450_000n,
  finalize: 7_000_000n,
  claim: 300_000n,
  propose: 7_000_000n,
  buyOutcome: 900_000n,
  sellOutcome: 900_000n,
  finalizeProposal: 12_000_000n,
  redeemAll: 700_000n,
  mergeAll: 700_000n,
  swapSpot: 600_000n,
};

export const GAS_MULTIPLIER_BPS = 11_500n;

export function gasLimitFor(estimate: bigint): bigint {
  return (estimate * GAS_MULTIPLIER_BPS) / 10_000n;
}

export class TxError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly hash?: Hash,
    readonly errorName?: string,
  ) {
    super(message);
  }
}

export type SendTxParams = {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Account;
  request: WriteRequest;
  chain?: Chain;
  onHash?: (hash: Hash) => void;
};

/**
 * The transaction pipeline used by bots and scripts (the web app runs the same steps through wagmi):
 * simulate → estimate → limit = est × 1.15 → send → receipt → on revert, replay to decode the reason.
 */
export async function sendTx(
  p: SendTxParams,
): Promise<{ hash: Hash; receipt: TransactionReceipt }> {
  const call = { ...p.request, account: p.account } as const;
  try {
    await p.publicClient.simulateContract(call as never);
  } catch (err) {
    const d = decodeMonetaError(err);
    throw new TxError(d.message, d.code, undefined, d.name);
  }
  const estimate = await p.publicClient.estimateContractGas(call as never);
  const hash = await p.walletClient.writeContract({
    ...(call as object),
    chain: p.chain ?? p.walletClient.chain,
    gas: gasLimitFor(estimate),
  } as never);
  p.onHash?.(hash);
  const receipt = await p.publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") {
    let message = "Transaction reverted.";
    let name: string | undefined;
    try {
      await p.publicClient.call({
        account: p.account,
        to: p.request.address,
        data: (await import("viem")).encodeFunctionData(p.request as never),
        blockNumber: receipt.blockNumber,
      });
    } catch (err) {
      const raw = (err as { data?: `0x${string}` }).data;
      const d = raw ? decodeRevertData(raw) : decodeMonetaError(err);
      message = d.message;
      name = d.name;
    }
    throw new TxError(message, "REVERT", hash, name);
  }
  return { hash, receipt };
}
