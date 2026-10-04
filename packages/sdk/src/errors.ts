import {
  BaseError,
  ContractFunctionRevertedError,
  decodeErrorResult,
  hexToString,
  InsufficientFundsError,
  UserRejectedRequestError,
  type Abi,
  type Hex,
} from "viem";
import {
  conditionalVaultAbi,
  monetaAmmAbi,
  monetaFactoryAbi,
  monetaRouterAbi,
  projectTokenAbi,
  raiseAbi,
  treasuryAbi,
} from "./generated/abis";

/** Every custom error any Moneta contract can raise, deduplicated by signature. */
export const MONETA_ERRORS_ABI: Abi = (() => {
  const seen = new Set<string>();
  const out: Abi[number][] = [];
  for (const abi of [
    monetaFactoryAbi,
    raiseAbi,
    treasuryAbi,
    monetaAmmAbi,
    conditionalVaultAbi,
    monetaRouterAbi,
    projectTokenAbi,
  ] as Abi[]) {
    for (const item of abi) {
      if (item.type !== "error") continue;
      const sig = `${item.name}(${item.inputs.map((i) => i.type).join(",")})`;
      if (!seen.has(sig)) {
        seen.add(sig);
        out.push(item);
      }
    }
  }
  return out;
})();

export type MonetaErrorCode =
  "USER_REJECTED" | "INSUFFICIENT_GAS_FUNDS" | "REVERT" | "RPC" | "TIMEOUT" | "UNKNOWN";

export type DecodedError = {
  code: MonetaErrorCode;
  /** Solidity error name when the call reverted with a custom error. */
  name?: string;
  message: string;
  retryable: boolean;
};

const ACTION_CODES: Record<number, string> = {
  1: "Only the founder can propose a tranche release.",
  2: "That tranche doesn't exist.",
  3: "That tranche was already released.",
  4: "An address in this action is empty.",
  5: "Amounts must be greater than zero.",
  6: "This mint exceeds the per-proposal cap (20% of supply).",
  7: "That call target is not allowed (protocol contracts and the project token are protected).",
};

const PARAM_LABELS: Record<string, string> = {
  name: "Token name must be 1–32 characters.",
  symbol: "Symbol must be 1–11 characters.",
  price: "Price is invalid for this raise size.",
  raiseRange: "Maximum raise must be at least the minimum.",
  start: "Start time is too far in the future.",
  window: "Raise window is outside the allowed range.",
  liquidity: "Liquidity share is outside the allowed range.",
  tranches: "Tranches must be positive and sum to at most 100%.",
  perf: "Performance tranches must have increasing multiples and amounts.",
  warmup: "Warm-up is outside the allowed range.",
  duration: "Trading window is outside the allowed range.",
  proposalLiquidityBps: "Proposal liquidity share is outside the allowed range.",
  maxStepBps: "Oracle step is outside the allowed range.",
  theta: "A threshold is outside the allowed range.",
  bond: "Bond is below the minimum.",
  executionGrace: "Execution grace is below the minimum.",
  index: "That performance tranche doesn't exist.",
  shareBps: "Invalid liquidity share.",
  twapWindow: "Invalid TWAP window.",
  bounds: "Invalid protocol bounds.",
};

const MESSAGES: Record<string, (args: readonly unknown[]) => string> = {
  NotOpen: () => "This raise isn't accepting contributions right now.",
  TooEarly: () => "Too early — the window hasn't ended yet.",
  AlreadyFinalized: () => "Already finalized.",
  NotFinalized: () => "The raise hasn't been finalized yet.",
  NothingToClaim: () => "Nothing to claim for this wallet.",
  AlreadyClaimed: () => "Already claimed.",
  GraceNotOver: () => "The finalize grace period hasn't passed yet.",
  CreationPaused: () => "New raise creation is temporarily paused.",
  QuoteNotAllowed: () => "That quote asset isn't supported.",
  MemoTooLarge: (a) => `Memo is too large (${a[0]} bytes, max ${a[1]}).`,
  InvalidParam: (a) => {
    const field =
      typeof a[0] === "string" ? hexToString(a[0] as Hex, { size: 32 }).replace(/\0/g, "") : "";
    return PARAM_LABELS[field] ?? `Invalid parameter: ${field}.`;
  },
  Slippage: () => "Price moved beyond your slippage tolerance.",
  TradingClosed: () => "Trading has closed for this market.",
  PoolIsClosed: () => "This pool is closed.",
  NoLiquidity: () => "This pool has no liquidity.",
  SlotBusy: () => "Another proposal is live. Wait for its verdict (only a Redemption can queue).",
  RedemptionQueued: () => "A Redemption is queued — no other proposals until it is decided.",
  InvalidAction: (a) => ACTION_CODES[Number(a[0])] ?? "Invalid proposal action.",
  NotActive: () => "This proposal isn't live.",
  NotPassed: () => "Only passed proposals can be executed.",
  ExecutionExpired: () => "The execution window for this proposal has expired.",
  InsufficientFunds: () => "The treasury doesn't hold enough funds for this.",
  NotFounder: () => "Only the founder can do this.",
  ProjectRedeemed: () => "This project has been redeemed (wound down).",
  NotRedeemed: () => "Redemption hasn't started for this project.",
  TargetNotMet: () => "The price target hasn't been met.",
  AlreadyUnlocked: () => "Already unlocked.",
  UnlockNotStarted: () => "Start the unlock first.",
  NotResolved: () => "This market hasn't been decided yet.",
  AlreadyResolved: () => "This market is already decided.",
  UnknownTreasury: () => "Unknown project.",
  ZeroAmount: () => "Amount must be greater than zero.",
  ZeroAddress: () => "Address can't be empty.",
  Unauthorized: () => "Not authorized.",
  TransferAmountMismatch: () => "Token transfer amount mismatch.",
  ERC20InsufficientBalance: () => "Insufficient token balance.",
  ERC20InsufficientAllowance: () => "Token approval is too low.",
};

function describe(name: string, args: readonly unknown[] = []): string {
  return MESSAGES[name]?.(args) ?? `Transaction reverted: ${name}.`;
}

/** Decode raw revert data (e.g. from a receipt replay) into a human message. */
export function decodeRevertData(data: Hex): DecodedError {
  try {
    const { errorName, args } = decodeErrorResult({ abi: MONETA_ERRORS_ABI, data });
    return {
      code: "REVERT",
      name: errorName,
      message: describe(errorName, args ?? []),
      retryable: false,
    };
  } catch {
    return { code: "REVERT", message: "Transaction reverted.", retryable: false };
  }
}

/** Classify any error thrown by viem/wagmi into an actionable, user-facing message. */
export function decodeMonetaError(err: unknown): DecodedError {
  if (err instanceof BaseError) {
    const rejected = err.walk((e) => e instanceof UserRejectedRequestError);
    if (rejected)
      return { code: "USER_REJECTED", message: "Request rejected in wallet.", retryable: true };
    const funds = err.walk((e) => e instanceof InsufficientFundsError);
    if (funds) {
      return {
        code: "INSUFFICIENT_GAS_FUNDS",
        message: "Not enough MON to pay for gas.",
        retryable: true,
      };
    }
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName ?? revert.reason;
      if (name) {
        return {
          code: "REVERT",
          name,
          message: describe(name, revert.data?.args ?? []),
          retryable: false,
        };
      }
      if (revert.raw) return decodeRevertData(revert.raw);
    }
    const msg = err.shortMessage || err.message;
    if (/timed? ?out/i.test(msg))
      return { code: "TIMEOUT", message: "The request timed out. Try again.", retryable: true };
    if (/HTTP|fetch|network|429|rate/i.test(msg)) {
      return {
        code: "RPC",
        message: "Network/RPC error. Retrying usually helps.",
        retryable: true,
      };
    }
    return { code: "UNKNOWN", message: msg, retryable: true };
  }
  return {
    code: "UNKNOWN",
    message: err instanceof Error ? err.message : String(err),
    retryable: true,
  };
}
