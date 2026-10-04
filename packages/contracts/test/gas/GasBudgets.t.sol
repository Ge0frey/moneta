// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ProjectToken} from "../../src/ProjectToken.sol";
import {Raise} from "../../src/Raise.sol";
import {Treasury} from "../../src/Treasury.sol";
import "../../src/types/MonetaTypes.sol";
import {MonetaTestBase} from "../utils/MonetaTestBase.sol";

/// @notice Gas ceilings per user operation. Monad charges the gas LIMIT, so the SDK sets limits from estimates
///         capped by these budgets; every heavy path must stay far below the 30M per-tx limit.
contract GasBudgetsTest is MonetaTestBase {
    uint256 constant TX_LIMIT = 30_000_000;

    function _measure(address target, bytes memory data, address from) internal returns (uint256 used) {
        vm.prank(from);
        uint256 g = gasleft();
        (bool ok, bytes memory ret) = target.call(data);
        used = g - gasleft();
        if (!ok) {
            assembly {
                revert(add(ret, 0x20), mload(ret))
            }
        }
    }

    function test_gasBudgets() public {
        RaiseParams memory p = _params();
        uint256 createGas = _measure(
            address(factory), abi.encodeCall(factory.createRaise, (p, string(new bytes(4000)))), founder
        );
        Raise r = Raise(factory.raiseOf(1));
        vm.prank(alice);
        usdc.approve(address(r), type(uint256).max);
        uint256 contributeGas = _measure(address(r), abi.encodeCall(r.contribute, (500e6)), alice);
        vm.warp(r.end());
        uint256 finalizeRaiseGas = _measure(address(r), abi.encodeCall(r.finalize, ()), bob);
        uint256 claimGas = _measure(address(r), abi.encodeCall(r.claim, ()), alice);

        Treasury t = Treasury(r.treasury());
        vm.prank(founder);
        usdc.approve(address(t), type(uint256).max);
        vm.prank(carol);
        usdc.approve(address(t), type(uint256).max);
        uint256 proposeGas = _measure(
            address(t),
            abi.encodeCall(t.propose, (ActionType.TrancheRelease, abi.encode(uint8(0)), "M1", noPermit)),
            founder
        );
        // queue a redemption so finalize also activates the next markets (worst case)
        _measure(address(t), abi.encodeCall(t.propose, (ActionType.Redeem, "", "", noPermit)), carol);

        uint256 buyGas = _measure(
            address(router),
            abi.encodeCall(router.buyOutcome, (address(t), 1, true, 50e6, 0, noPermit)),
            alice
        );
        vm.warp(t.proposal(1).tradingEnd);
        uint256 finalizeProposalGas = _measure(address(t), abi.encodeCall(t.finalizeProposal, (1)), dave);
        uint256 redeemAllGas =
            _measure(address(router), abi.encodeCall(router.redeemAll, (address(t), 1)), alice);

        emit log_named_uint("createRaise (4KB memo)", createGas);
        emit log_named_uint("contribute", contributeGas);
        emit log_named_uint("finalize raise (launch)", finalizeRaiseGas);
        emit log_named_uint("claim", claimGas);
        emit log_named_uint("propose + activate markets", proposeGas);
        emit log_named_uint("buyOutcome", buyGas);
        emit log_named_uint("finalizeProposal + execute + activate queued", finalizeProposalGas);
        emit log_named_uint("redeemAll", redeemAllGas);

        assertLt(createGas, 2_500_000);
        assertLt(contributeGas, 200_000);
        assertLt(finalizeRaiseGas, 3_500_000);
        assertLt(claimGas, 150_000);
        assertLt(proposeGas, 3_500_000);
        assertLt(buyGas, 450_000);
        assertLt(finalizeProposalGas, 6_000_000);
        assertLt(redeemAllGas, 350_000);
        assertLt(finalizeProposalGas * 4, TX_LIMIT, "4x headroom under Monad's per-tx limit");
    }
}
