// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {MonetaRouter} from "../../src/MonetaRouter.sol";
import {ProjectToken} from "../../src/ProjectToken.sol";
import {Raise} from "../../src/Raise.sol";
import {Treasury} from "../../src/Treasury.sol";
import "../../src/types/MonetaErrors.sol";
import "../../src/types/MonetaTypes.sol";
import {MonetaTestBase} from "../utils/MonetaTestBase.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MonetaRouterTest is MonetaTestBase {
    Raise r;
    Treasury t;
    ProjectToken lum;
    uint256 id;
    Proposal p;
    address pT;
    address fT;
    address pQ;
    address fQ;

    function setUp() public override {
        super.setUp();
        (r, t, lum) = _launch(600e6, 400e6);
        _claimAll(r);
        vm.prank(founder);
        id = t.propose(ActionType.TrancheRelease, abi.encode(uint8(0)), "M1", noPermit);
        p = t.proposal(id);
        (pT, fT) = vault.tokensOf(p.conditionId, address(lum));
        (pQ, fQ) = vault.tokensOf(p.conditionId, address(usdc));
    }

    function _assertRouterEmpty() internal view {
        address[6] memory tokens = [address(usdc), address(lum), pT, fT, pQ, fQ];
        for (uint256 i; i < tokens.length; ++i) {
            assertEq(IERC20(tokens[i]).balanceOf(address(router)), 0, "router holds nothing");
        }
    }

    function test_buyOutcome_givesSideTokenAndOtherSideQuote() public {
        (uint256 expected,) = amm.quote(p.passPoolId, false, 50e6);
        vm.expectEmit(true, true, true, true, address(router));
        emit MonetaRouter.OutcomeTraded(address(t), id, carol, true, true, 50e6, expected);
        uint256 out = _buy(carol, t, id, true, 50e6);
        assertEq(out, expected);
        assertEq(IERC20(pT).balanceOf(carol), out);
        assertEq(IERC20(fQ).balanceOf(carol), 50e6, "FAIL-world USDC returned: stake safe if FAIL");
        assertEq(IERC20(pQ).balanceOf(carol), 0);
        _assertRouterEmpty();
    }

    function test_buyOutcome_slippageAndGuards() public {
        (uint256 expected,) = amm.quote(p.passPoolId, false, 50e6);
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(Slippage.selector, expected, expected + 1));
        router.buyOutcome(address(t), id, true, 50e6, expected + 1, noPermit);

        vm.prank(carol);
        vm.expectRevert(UnknownTreasury.selector);
        router.buyOutcome(address(0xBEEF), id, true, 50e6, 0, noPermit);

        vm.prank(carol);
        vm.expectRevert(ZeroAmount.selector);
        router.buyOutcome(address(t), id, true, 0, 0, noPermit);

        _finalizeAfterWindow(t, id);
        vm.prank(carol);
        vm.expectRevert(NotActive.selector);
        router.buyOutcome(address(t), id, true, 50e6, 0, noPermit);
    }

    function test_buyOutcome_withPermit() public {
        vm.prank(alice);
        usdc.approve(address(router), 0);
        uint256 deadline = block.timestamp + 600;
        (uint8 v, bytes32 rs, bytes32 s) = _permitSig(aliceKey, alice, address(router), 20e6, deadline);
        vm.prank(alice);
        router.buyOutcome(address(t), id, false, 20e6, 0, PermitArgs(true, 20e6, deadline, v, rs, s));
        assertGt(IERC20(fT).balanceOf(alice), 0);
    }

    function test_sellOutcome_settlesToUsdc() public {
        uint256 got = _buy(carol, t, id, true, 50e6);
        uint256 usdcBefore = usdc.balanceOf(carol);
        vm.prank(carol);
        (uint256 usdcOut, uint256 left) = router.sellOutcome(address(t), id, true, got, 0);
        assertGt(usdcOut, 0);
        assertEq(left, 0, "had enough FAIL-USDC to merge everything");
        assertEq(usdc.balanceOf(carol) - usdcBefore, usdcOut);
        assertLt(usdcOut, 50e6, "fees and impact on a round trip");
        assertGt(usdcOut, 49e6);
        assertEq(IERC20(pT).balanceOf(carol), 0);
        _assertRouterEmpty();
    }

    function test_mergeAll_beforeVerdict() public {
        vm.prank(dave);
        vault.split(p.conditionId, address(usdc), 30e6, dave);
        vm.prank(dave);
        (, uint256 merged) = router.mergeAll(address(t), id);
        assertEq(merged, 30e6);
        assertEq(IERC20(pQ).balanceOf(dave), 0);
        assertEq(usdc.balanceOf(dave), 100_000e6);
        _assertRouterEmpty();
    }

    function test_redeemAll_paysWinnersOnly() public {
        uint256 passBought = _buy(carol, t, id, true, 80e6);
        _buy(dave, t, id, false, 10e6);

        vm.prank(carol);
        vm.expectRevert(NotResolved.selector);
        router.redeemAll(address(t), id);

        _finalizeAfterWindow(t, id);
        assertEq(uint8(vault.outcomeOf(p.conditionId)), uint8(Outcome.Pass));

        vm.prank(carol);
        (uint256 tokenOut, uint256 quoteOut) = router.redeemAll(address(t), id);
        assertEq(tokenOut, passBought, "pLUM redeems to LUM 1:1");
        assertEq(quoteOut, 0, "carol's fUSDC is void");
        assertEq(lum.balanceOf(carol), passBought);

        vm.prank(dave);
        (uint256 dTok, uint256 dQ) = router.redeemAll(address(t), id);
        assertEq(dTok, 0, "dave's fLUM is void");
        assertEq(dQ, 10e6, "dave's pUSDC redeems 1:1");
        _assertRouterEmpty();
    }

    function test_redeemAll_cannotTouchOthersPositions() public {
        uint256 bought = _buy(carol, t, id, true, 40e6);
        _finalizeAfterWindow(t, id);
        vm.prank(dave); // attacker with no positions
        (uint256 a, uint256 b) = router.redeemAll(address(t), id);
        assertEq(a + b, 0);
        assertEq(IERC20(pT).balanceOf(carol), bought, "victim untouched");
    }

    function test_swapSpot_buyAndSell() public {
        vm.prank(carol);
        uint256 got = router.swapSpot(address(t), true, 10e6, 0, noPermit);
        assertEq(lum.balanceOf(carol), got);
        vm.startPrank(carol);
        lum.approve(address(router), got);
        uint256 back = router.swapSpot(address(t), false, got, 0, noPermit);
        vm.stopPrank();
        assertGt(back, 9.8e6);
        _assertRouterEmpty();
    }
}
