// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Bounds, GovConfig} from "../../src/types/MonetaTypes.sol";

/// @notice Shared parameter fixtures (testnet-like bounds; fast, minute-scale governance).
library Fixtures {
    function bounds() internal pure returns (Bounds memory) {
        return Bounds({
            minRaiseWindow: 60,
            maxRaiseWindow: 30 days,
            maxStartDelay: 30 days,
            finalizeGrace: 600,
            minLiquidityBps: 500,
            maxLiquidityBps: 5000,
            maxTranches: 8,
            maxPerfTranches: 5,
            minWarmup: 0,
            maxWarmup: 7 days,
            minDuration: 60,
            maxDuration: 14 days,
            minProposalLiquidityBps: 1000,
            maxProposalLiquidityBps: 9000,
            minMaxStepBps: 1,
            maxMaxStepBps: 1000,
            minTheta: -500,
            maxTheta: 2000,
            minBond: 0,
            minExecutionGrace: 60,
            maxMintBps: 2000,
            maxMemoBytes: 16_384
        });
    }

    function gov() internal pure returns (GovConfig memory) {
        return GovConfig({
            thetaTrancheBps: 0,
            thetaTeamBps: 100,
            thetaCommunityBps: 300,
            proposalLiquidityBps: 5000,
            maxStepBps: 100,
            warmup: 30,
            duration: 180,
            executionGrace: 600,
            bond: 1e6
        });
    }
}
