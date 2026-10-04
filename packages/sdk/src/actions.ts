import { decodeAbiParameters, encodeAbiParameters, type Address, type Hex } from "viem";
import { ActionType } from "./constants";
import type { GovConfig } from "./types";

/** Typed proposal actions ⇄ (ActionType, ABI payload) — mirrors Treasury.executeAction decoding. */

export type ProposalAction =
  | { type: "TrancheRelease"; index: number }
  | { type: "Transfer"; token: Address; to: Address; amount: bigint }
  | { type: "SetBudget"; perMonth: bigint }
  | { type: "Mint"; to: Address; amount: bigint }
  | { type: "Buyback"; quoteIn: bigint; minOut: bigint }
  | { type: "UpdateConfig"; config: GovConfig }
  | { type: "SetFounder"; founder: Address }
  | { type: "Call"; target: Address; data: Hex }
  | { type: "Redeem" };

export const GOV_CONFIG_ABI = {
  type: "tuple",
  components: [
    { name: "thetaTrancheBps", type: "int16" },
    { name: "thetaTeamBps", type: "int16" },
    { name: "thetaCommunityBps", type: "int16" },
    { name: "proposalLiquidityBps", type: "uint16" },
    { name: "maxStepBps", type: "uint16" },
    { name: "warmup", type: "uint40" },
    { name: "duration", type: "uint40" },
    { name: "executionGrace", type: "uint40" },
    { name: "bond", type: "uint128" },
  ],
} as const;

export function encodeAction(a: ProposalAction): { actionType: number; data: Hex } {
  switch (a.type) {
    case "TrancheRelease":
      return {
        actionType: ActionType.TrancheRelease,
        data: encodeAbiParameters([{ type: "uint8" }], [a.index]),
      };
    case "Transfer":
      return {
        actionType: ActionType.Transfer,
        data: encodeAbiParameters(
          [{ type: "address" }, { type: "address" }, { type: "uint256" }],
          [a.token, a.to, a.amount],
        ),
      };
    case "SetBudget":
      return {
        actionType: ActionType.SetBudget,
        data: encodeAbiParameters([{ type: "uint128" }], [a.perMonth]),
      };
    case "Mint":
      return {
        actionType: ActionType.Mint,
        data: encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [a.to, a.amount]),
      };
    case "Buyback":
      return {
        actionType: ActionType.Buyback,
        data: encodeAbiParameters(
          [{ type: "uint256" }, { type: "uint256" }],
          [a.quoteIn, a.minOut],
        ),
      };
    case "UpdateConfig":
      return {
        actionType: ActionType.UpdateConfig,
        data: encodeAbiParameters(
          [GOV_CONFIG_ABI],
          [{ ...a.config, warmup: a.config.warmup, bond: a.config.bond }],
        ),
      };
    case "SetFounder":
      return {
        actionType: ActionType.SetFounder,
        data: encodeAbiParameters([{ type: "address" }], [a.founder]),
      };
    case "Call":
      return {
        actionType: ActionType.Call,
        data: encodeAbiParameters([{ type: "address" }, { type: "bytes" }], [a.target, a.data]),
      };
    case "Redeem":
      return { actionType: ActionType.Redeem, data: "0x" };
  }
}

export function decodeAction(actionType: number, data: Hex): ProposalAction {
  switch (actionType) {
    case ActionType.TrancheRelease: {
      const [index] = decodeAbiParameters([{ type: "uint8" }], data);
      return { type: "TrancheRelease", index };
    }
    case ActionType.Transfer: {
      const [token, to, amount] = decodeAbiParameters(
        [{ type: "address" }, { type: "address" }, { type: "uint256" }],
        data,
      );
      return { type: "Transfer", token, to, amount };
    }
    case ActionType.SetBudget: {
      const [perMonth] = decodeAbiParameters([{ type: "uint128" }], data);
      return { type: "SetBudget", perMonth };
    }
    case ActionType.Mint: {
      const [to, amount] = decodeAbiParameters([{ type: "address" }, { type: "uint256" }], data);
      return { type: "Mint", to, amount };
    }
    case ActionType.Buyback: {
      const [quoteIn, minOut] = decodeAbiParameters(
        [{ type: "uint256" }, { type: "uint256" }],
        data,
      );
      return { type: "Buyback", quoteIn, minOut };
    }
    case ActionType.UpdateConfig: {
      const [c] = decodeAbiParameters([GOV_CONFIG_ABI], data);
      return {
        type: "UpdateConfig",
        config: {
          thetaTrancheBps: c.thetaTrancheBps,
          thetaTeamBps: c.thetaTeamBps,
          thetaCommunityBps: c.thetaCommunityBps,
          proposalLiquidityBps: c.proposalLiquidityBps,
          maxStepBps: c.maxStepBps,
          warmup: c.warmup,
          duration: c.duration,
          executionGrace: c.executionGrace,
          bond: c.bond,
        },
      };
    }
    case ActionType.SetFounder: {
      const [founder] = decodeAbiParameters([{ type: "address" }], data);
      return { type: "SetFounder", founder };
    }
    case ActionType.Call: {
      const [target, callData] = decodeAbiParameters(
        [{ type: "address" }, { type: "bytes" }],
        data,
      );
      return { type: "Call", target, data: callData };
    }
    case ActionType.Redeem:
      return { type: "Redeem" };
    default:
      throw new Error(`Unknown action type ${actionType}`);
  }
}

/** Short human title for an action (proposal lists, chips). */
export function actionTitle(a: ProposalAction): string {
  switch (a.type) {
    case "TrancheRelease":
      return `Release Tranche ${a.index + 1}`;
    case "Transfer":
      return "Treasury transfer";
    case "SetBudget":
      return "Change operating budget";
    case "Mint":
      return "Mint new tokens";
    case "Buyback":
      return "Buy back & burn";
    case "UpdateConfig":
      return "Update governance config";
    case "SetFounder":
      return "Change founder";
    case "Call":
      return "Arbitrary call";
    case "Redeem":
      return "Redeem treasury (wind down)";
  }
}
