// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ProjectToken} from "../../src/ProjectToken.sol";
import {Raise} from "../../src/Raise.sol";
import {Treasury} from "../../src/Treasury.sol";
import "../../src/types/MonetaErrors.sol";
import "../../src/types/MonetaTypes.sol";
import {MonetaTestBase} from "../utils/MonetaTestBase.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Pretends to be a treasury and points at real pools.
contract RogueTreasury {
    Proposal internal _p;
    address public token;
    address public quote;

    constructor(Proposal memory p, address token_, address quote_) {
        _p = p;
        token = token_;
        quote = quote_;
    }

    function proposal(uint256) external view returns (Proposal memory) {
        return _p;
    }
}

contract AttacksTest is MonetaTestBase {
    Raise r;
    Treasury t;
    ProjectToken lum;

    function setUp() public override {
        super.setUp();
        (r, t, lum) = _launch(600e6, 400e6);
        _claimAll(r);
        usdc.mint(dave, 1_000_000e6); // a whale attacker
    }

    /// Honest traders lean FAIL for the whole window; a whale pumps PASS in the final seconds.
    function test_lastSecondPumpCannotFlipVerdict() public {
        vm.prank(founder);
        uint256 id = t.propose(ActionType.TrancheRelease, abi.encode(uint8(0)), "", noPermit);
        _buy(bob, t, id, false, 60e6);
        uint40 end = t.proposal(id).tradingEnd;
        vm.warp(end - 3);
        _buy(dave, t, id, true, 900_000e6); // ~3,000x the honest flow
        vm.warp(end);
        (bool passing,,) = t.projectedVerdict(id);
        assertFalse(passing, "projection still FAIL");
        t.finalizeProposal(id);
        assertEq(uint8(t.proposal(id).status), uint8(ProposalStatus.Failed), "pump did not flip the verdict");
        // the whale's FAIL-side USDC comes back; PASS tokens are void — the attack only cost fees and slippage.
    }

    function test_dustSpamEverySecondDoesNotBlockFinalize() public {
        vm.prank(founder);
        uint256 id = t.propose(ActionType.TrancheRelease, abi.encode(uint8(0)), "", noPermit);
        uint40 end = t.proposal(id).tradingEnd;
        for (uint256 s = block.timestamp; s < end; s += 7) {
            vm.warp(s);
            _buy(dave, t, id, s % 2 == 0, 1e3);
        }
        vm.warp(end);
        t.finalizeProposal(id);
        assertTrue(uint8(t.proposal(id).status) >= uint8(ProposalStatus.Passed));
    }

    function test_fakeTreasuryRejectedByRouter() public {
        vm.prank(founder);
        uint256 id = t.propose(ActionType.TrancheRelease, abi.encode(uint8(0)), "", noPermit);
        RogueTreasury rogue = new RogueTreasury(t.proposal(id), address(lum), address(usdc));
        vm.prank(dave);
        vm.expectRevert(UnknownTreasury.selector);
        router.buyOutcome(address(rogue), id, true, 1e6, 0, noPermit);
        vm.prank(dave);
        vm.expectRevert(UnknownTreasury.selector);
        router.redeemAll(address(rogue), id);
    }

    function test_trustedSpenderCannotMoveVictimTokens() public {
        vm.prank(founder);
        uint256 id = t.propose(ActionType.TrancheRelease, abi.encode(uint8(0)), "", noPermit);
        uint256 bought = _buy(alice, t, id, true, 50e6);
        Proposal memory p = t.proposal(id);
        (address pT,) = vault.tokensOf(p.conditionId, address(lum));
        // dave tries to sell alice's PASS tokens through the router: it pulls from dave (msg.sender), not alice
        vm.prank(dave);
        vm.expectRevert();
        router.sellOutcome(address(t), id, true, bought, 0);
        // and the AMM pulls from its caller only
        vm.prank(dave);
        vm.expectRevert();
        amm.swap(p.passPoolId, true, bought, 0, dave);
        assertEq(IERC20(pT).balanceOf(alice), bought);
    }

    function test_founderCannotStarveRedemption() public {
        vm.prank(founder);
        uint256 id = t.propose(ActionType.TrancheRelease, abi.encode(uint8(0)), "", noPermit);
        vm.prank(carol);
        usdc.approve(address(t), type(uint256).max);
        vm.prank(carol);
        uint256 rid = t.propose(ActionType.Redeem, "", "", noPermit);

        vm.prank(founder);
        vm.expectRevert(RedemptionQueued.selector);
        t.propose(ActionType.TrancheRelease, abi.encode(uint8(1)), "", noPermit);

        _finalizeAfterWindow(t, id);
        assertEq(t.activeProposalId(), rid, "redemption activated next, automatically");
        vm.prank(founder);
        vm.expectRevert(SlotBusy.selector);
        t.propose(ActionType.TrancheRelease, abi.encode(uint8(1)), "", noPermit);
    }

    function test_frontRunPermitDoesNotBlockContribution() public {
        Raise r2 = _create(_params());
        uint256 deadline = block.timestamp + 600;
        (uint8 v, bytes32 rs, bytes32 s) = _permitSig(aliceKey, alice, address(r2), 100e6, deadline);
        // griefer submits alice's permit first
        usdc.permit(alice, address(r2), 100e6, deadline, v, rs, s);
        vm.prank(alice);
        r2.contributeWithPermit(100e6, deadline, v, rs, s);
        assertEq(r2.contributionOf(alice), 100e6);
    }

    /// A caller can starve the try/catch'd execution of gas; the verdict stands and anyone can retry.
    function test_executionGasGriefingIsRecoverable() public {
        vm.prank(founder);
        uint256 id = t.propose(ActionType.TrancheRelease, abi.encode(uint8(0)), "", noPermit);
        _buy(alice, t, id, true, 100e6);
        vm.warp(t.proposal(id).tradingEnd);
        uint256 gasForFinalizeOnly = 1_450_000;
        (bool ok,) = address(t).call{gas: gasForFinalizeOnly}(abi.encodeCall(Treasury.finalizeProposal, (id)));
        if (ok && t.proposal(id).status == ProposalStatus.Passed) {
            t.executeProposal(id);
        } else if (!ok) {
            t.finalizeProposal(id);
        }
        assertEq(uint8(t.proposal(id).status), uint8(ProposalStatus.Executed));
        assertTrue(t.tranches()[0].released);
    }
}
