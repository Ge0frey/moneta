// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {InvalidParam} from "../types/MonetaErrors.sol";
import {Bounds, GovConfig} from "../types/MonetaTypes.sol";

/// @title Validation
/// @notice Governance-config bounds checks shared by the factory (at raise creation) and the Treasury (UpdateConfig).
library Validation {
    function validateGov(GovConfig memory g, Bounds memory b) internal pure {
        if (g.warmup < b.minWarmup || g.warmup > b.maxWarmup) revert InvalidParam("warmup");
        if (g.duration < b.minDuration || g.duration > b.maxDuration) revert InvalidParam("duration");
        if (
            g.proposalLiquidityBps < b.minProposalLiquidityBps
                || g.proposalLiquidityBps > b.maxProposalLiquidityBps
        ) {
            revert InvalidParam("proposalLiquidityBps");
        }
        if (g.maxStepBps < b.minMaxStepBps || g.maxStepBps > b.maxMaxStepBps) {
            revert InvalidParam("maxStepBps");
        }
        if (
            !_thetaOk(g.thetaTrancheBps, b) || !_thetaOk(g.thetaTeamBps, b)
                || !_thetaOk(g.thetaCommunityBps, b)
        ) {
            revert InvalidParam("theta");
        }
        if (g.bond < b.minBond) revert InvalidParam("bond");
        if (g.executionGrace < b.minExecutionGrace) revert InvalidParam("executionGrace");
    }

    function _thetaOk(int16 theta, Bounds memory b) private pure returns (bool) {
        return theta >= b.minTheta && theta <= b.maxTheta;
    }
}
