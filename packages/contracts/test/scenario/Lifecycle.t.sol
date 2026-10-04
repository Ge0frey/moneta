// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ProjectToken} from "../../src/ProjectToken.sol";
import {Raise} from "../../src/Raise.sol";
import {Treasury} from "../../src/Treasury.sol";
import "../../src/types/MonetaTypes.sol";
import {MonetaTestBase} from "../utils/MonetaTestBase.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice The full lifecycle, end to end, with conservation checks at every step:
///         create → raise (permit + plain) → launch → claim → budget → tranche PASS → bad idea FAIL → redemption.
contract LifecycleScenarioTest is MonetaTestBase {
    uint256 constant USDC_SUPPLY = 5 * 100_000e6; // five funded actors

    function _totalUsdcTracked(Raise raise_, Treasury treasury_) internal view returns (uint256 sum) {
        address[9] memory holders =
            [founder, alice, bob, carol, dave, feeTo, address(raise_), address(treasury_), address(amm)];
        for (uint256 i; i < holders.length; ++i) {
            sum += usdc.balanceOf(holders[i]);
        }
        sum += usdc.balanceOf(address(vault));
    }

    Raise r;
    Treasury t;
    ProjectToken lum;
    address[3] backers;

    function test_fullLifecycle_endToEnd() public {
        backers = [alice, bob, carol];
        _step1to3_createRaiseLaunch();
        _step4_budget();
        _step5_tranchePass();
        _step6_badIdeaFails();
        _step7_redemption();
    }

    function _step1to3_createRaiseLaunch() internal {
        // 1. Founder creates "Lumen" permissionlessly.
        r = _create(_params());

        // 2. Backers commit — alice in one tx via permit.
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 rs, bytes32 s) = _permitSig(aliceKey, alice, address(r), 450e6, deadline);
        vm.prank(alice);
        r.contributeWithPermit(450e6, deadline, v, rs, s);
        _contribute(bob, r, 350e6);
        _contribute(carol, r, 200e6);
        assertEq(r.totalContributed(), 1000e6);
        assertEq(r.contributorCount(), 3);

        // 3. Window ends; anyone finalizes; token + liquidity + treasury in one tx.
        vm.warp(r.end());
        vm.prank(dave);
        r.finalize();
        t = Treasury(r.treasury());
        lum = ProjectToken(r.token());
        assertEq(uint8(r.status()), uint8(RaiseStatus.Succeeded));
        assertEq(_totalUsdcTracked(r, t), USDC_SUPPLY, "USDC conserved after launch");

        for (uint256 i; i < 3; ++i) {
            vm.prank(backers[i]);
            r.claim();
            vm.prank(backers[i]);
            usdc.approve(address(t), type(uint256).max);
        }
        vm.prank(founder);
        usdc.approve(address(t), type(uint256).max);
        vm.prank(dave);
        usdc.approve(address(t), type(uint256).max);
        assertEq(lum.balanceOf(alice), 4500e18);
    }

    function _step4_budget() internal {
        vm.warp(block.timestamp + 6 days);
        vm.prank(founder);
        uint256 budget = t.claimBudget();
        assertEq(budget, 6e6);
    }

    function _step5_tranchePass() internal {
        // "Release Tranche 2" — the market believes: PASS → tranche paid automatically.
        vm.prank(founder);
        uint256 t2 =
            t.propose(ActionType.TrancheRelease, abi.encode(uint8(1)), "Mainnet v1 shipped", noPermit);
        _buy(alice, t, t2, true, 120e6);
        _buy(bob, t, t2, true, 60e6);
        _buy(carol, t, t2, false, 20e6);
        uint256 founderBefore = usdc.balanceOf(founder);
        _finalizeAfterWindow(t, t2);
        Proposal memory pr = t.proposal(t2);
        assertEq(uint8(pr.status), uint8(ProposalStatus.Executed), "Verdict: PASS, executed");
        assertGt(pr.twapPass, pr.twapFail);
        assertEq(
            usdc.balanceOf(founder) - founderBefore, t.tranches()[1].amount + 1e6, "tranche + bond refund"
        );
        for (uint256 i; i < 3; ++i) {
            vm.prank(backers[i]);
            router.redeemAll(address(t), t2);
        }
        assertEq(_totalUsdcTracked(r, t), USDC_SUPPLY, "USDC conserved through a decision market");
    }

    function _step6_badIdeaFails() internal {
        // "Spend 40% on a celebrity endorsement" — the market disagrees: FAIL → nothing moves.
        uint256 treasuryBefore = t.availableQuote();
        vm.prank(dave);
        uint256 bad = t.propose(
            ActionType.Transfer,
            abi.encode(address(usdc), dave, treasuryBefore * 40 / 100),
            "Celebrity endorsement",
            noPermit
        );
        _buy(alice, t, bad, false, 150e6);
        _buy(bob, t, bad, false, 80e6);
        _finalizeAfterWindow(t, bad);
        assertEq(uint8(t.proposal(bad).status), uint8(ProposalStatus.Failed), "Verdict: FAIL");
        assertGe(t.availableQuote(), treasuryBefore, "capital stays (plus forfeited bond)");
        for (uint256 i; i < 2; ++i) {
            vm.prank(backers[i]);
            router.redeemAll(address(t), bad);
        }
    }

    function _step7_redemption() internal {
        // Safety net: holders vote with markets to redeem at NAV.
        (,, uint256 navPerToken) = t.nav();
        vm.prank(carol);
        uint256 red = t.propose(ActionType.Redeem, "", "Wind down: return treasury", noPermit);
        _buy(alice, t, red, true, 200e6);
        _buy(bob, t, red, true, 100e6);
        _finalizeAfterWindow(t, red);
        assertEq(uint8(t.state()), uint8(ProjectState.Redeemed));
        for (uint256 i; i < 3; ++i) {
            vm.prank(backers[i]);
            router.redeemAll(address(t), red);
        }

        uint256 aliceTokens = lum.balanceOf(alice);
        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        uint256 paid = t.redeem(aliceTokens);
        assertEq(usdc.balanceOf(alice) - before, paid);
        assertApproxEqRel(paid * 1e18 / aliceTokens, navPerToken, 0.25e18, "redemption near pre-vote NAV");

        for (uint256 i = 1; i < 3; ++i) {
            uint256 bal = lum.balanceOf(backers[i]);
            if (bal > 0) {
                vm.prank(backers[i]);
                t.redeem(bal);
            }
        }
        assertEq(_totalUsdcTracked(r, t), USDC_SUPPLY, "USDC conserved end to end");
        assertLt(t.availableQuote(), 1e6, "treasury fully distributed (dust only)");
        assertEq(IERC20(address(lum)).balanceOf(address(t)), 0);
    }
}
