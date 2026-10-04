// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ProjectToken} from "../../src/ProjectToken.sol";
import {Raise} from "../../src/Raise.sol";
import {Treasury} from "../../src/Treasury.sol";
import {IMonetaFactory} from "../../src/interfaces/IMonetaFactory.sol";
import "../../src/types/MonetaErrors.sol";
import "../../src/types/MonetaTypes.sol";
import {Fixtures} from "../utils/Fixtures.sol";
import {MintableERC20} from "../utils/MintableERC20.sol";
import {MonetaTestBase} from "../utils/MonetaTestBase.sol";

contract RaiseFactoryTest is MonetaTestBase {
    // ── factory: creation & validation ───────────────────────────────────────

    function test_createRaise_registersAndEmits() public {
        RaiseParams memory p = _params();
        address predicted = factory.predictRaise(1);
        vm.expectEmit(true, true, true, false, address(factory));
        emit IMonetaFactory.RaiseCreated(1, predicted, founder, founder, address(usdc), p, bytes32(0), "");
        Raise r = _create(p);
        assertEq(address(r), predicted);
        assertTrue(factory.isRaise(address(r)));
        assertEq(factory.raiseIdOf(address(r)), 1);
        assertEq(r.price(), 0.1e6);
        assertEq(r.feeBps(), 100);
        assertEq(r.finalizeGrace(), 600);
        assertEq(uint8(r.status()), uint8(RaiseStatus.Open));
    }

    function test_createRaise_normalizesPastStart() public {
        RaiseParams memory p = _params();
        p.start = 1;
        Raise r = _create(p);
        assertEq(r.start(), block.timestamp);
    }

    function test_createRaise_validation() public {
        _expectInvalid(_mut(0), "name");
        _expectInvalid(_mut(1), "symbol");
        _expectInvalid(_mut(2), "price");
        _expectInvalid(_mut(3), "raiseRange");
        _expectInvalid(_mut(4), "window");
        _expectInvalid(_mut(5), "liquidity");
        _expectInvalid(_mut(6), "tranches");
        _expectInvalid(_mut(7), "perf");
        _expectInvalid(_mut(8), "duration");
        _expectInvalid(_mut(9), "theta");
    }

    function _mut(uint256 which) internal view returns (RaiseParams memory p) {
        p = _params();
        if (which == 0) {
            p.name = "";
        } else if (which == 1) {
            p.symbol = "WAYTOOLONGSYMBOL";
        } else if (which == 2) {
            p.price = 0;
        } else if (which == 3) {
            p.maxRaise = p.minRaise - 1;
        } else if (which == 4) {
            p.end = p.start + 10;
        } else if (which == 5) {
            p.liquidityBps = 100;
        } else if (which == 6) {
            p.trancheBps[0] = 6000;
        } else if (which == 7) {
            p.perf = new PerfTranche[](2);
            p.perf[0] = PerfTranche(300, 1e18);
            p.perf[1] = PerfTranche(200, 1e18);
            p.perfUnlockWindow = 60;
        } else if (which == 8) {
            p.gov.duration = 1;
        } else if (which == 9) {
            p.gov.thetaCommunityBps = 5000;
        }
    }

    function _expectInvalid(RaiseParams memory p, bytes32 field) internal {
        vm.prank(founder);
        vm.expectRevert(abi.encodeWithSelector(InvalidParam.selector, field));
        factory.createRaise(p, "");
    }

    function test_createRaise_guards() public {
        RaiseParams memory p = _params();
        p.quote = address(new MintableERC20("Other", "OTH", 6));
        vm.expectRevert(abi.encodeWithSelector(QuoteNotAllowed.selector, p.quote));
        factory.createRaise(p, "");

        p = _params();
        p.founder = address(0);
        vm.expectRevert(ZeroAddress.selector);
        factory.createRaise(p, "");

        vm.expectRevert(abi.encodeWithSelector(MemoTooLarge.selector, 16_385, 16_384));
        factory.createRaise(_params(), string(new bytes(16_385)));

        factory.setCreationPaused(true);
        vm.expectRevert(CreationPaused.selector);
        factory.createRaise(_params(), "");
    }

    // ── factory: admin ───────────────────────────────────────────────────────

    function test_admin_onlyOwnerAndCaps() public {
        vm.prank(alice);
        vm.expectRevert();
        factory.setFees(0, 0);
        vm.expectRevert(FeeTooHigh.selector);
        factory.setFees(301, 30);
        vm.expectRevert(FeeTooHigh.selector);
        factory.setFees(100, 101);
        factory.setFees(300, 100);
        assertEq(factory.raiseFeeBps(), 300);

        Bounds memory b = Fixtures.bounds();
        b.minDuration = b.maxDuration + 1;
        vm.expectRevert(abi.encodeWithSelector(InvalidParam.selector, bytes32("bounds")));
        factory.setBounds(b);
    }

    function test_launch_onlyFromOwnRaise() public {
        vm.expectRevert(UnknownRaise.selector);
        factory.launch(1, "");
        Raise r = _create(_params());
        bytes memory cfg = r.projectConfig();
        vm.prank(alice);
        vm.expectRevert(UnknownRaise.selector);
        factory.launch(1, cfg);
    }

    function test_feeChangeDoesNotAffectLiveRaise() public {
        Raise r = _create(_params());
        factory.setFees(300, 30);
        assertEq(r.feeBps(), 100, "fee snapshotted at creation");
    }

    // ── raise: contributions ─────────────────────────────────────────────────

    function test_contribute_windowAndAccounting() public {
        RaiseParams memory p = _params();
        p.start = uint40(block.timestamp + 100);
        p.end = p.start + 600;
        Raise r = _create(p);

        vm.startPrank(alice);
        usdc.approve(address(r), type(uint256).max);
        vm.expectRevert(NotOpen.selector);
        r.contribute(1e6);
        vm.warp(p.start);
        vm.expectRevert(ZeroAmount.selector);
        r.contribute(0);
        r.contribute(100e6);
        r.contribute(50e6);
        vm.stopPrank();

        assertEq(r.contributionOf(alice), 150e6);
        assertEq(r.contributorCount(), 1);
        assertEq(r.totalContributed(), 150e6);
        vm.warp(p.end);
        vm.prank(alice);
        vm.expectRevert(NotOpen.selector);
        r.contribute(1e6);
    }

    function test_contributeWithPermit_singleTx() public {
        Raise r = _create(_params());
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 rs, bytes32 s) = _permitSig(aliceKey, alice, address(r), 250e6, deadline);
        vm.prank(alice);
        r.contributeWithPermit(250e6, deadline, v, rs, s);
        assertEq(r.contributionOf(alice), 250e6);
    }

    // ── raise: finalize & claim ──────────────────────────────────────────────

    function test_finalize_failedBelowMinRefundsAll() public {
        Raise r = _create(_params());
        _contribute(alice, r, 100e6);
        vm.expectRevert(TooEarly.selector);
        r.finalize();
        vm.warp(r.end());
        r.finalize();
        assertEq(uint8(r.status()), uint8(RaiseStatus.Failed));
        assertEq(r.treasury(), address(0));

        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        (uint256 tokens, uint256 refund) = r.claim();
        assertEq(tokens, 0);
        assertEq(refund, 100e6);
        assertEq(usdc.balanceOf(alice) - before, 100e6);
    }

    function test_finalize_successLaunchesProjectAtomically() public {
        (Raise r, Treasury t, ProjectToken token) = _launch(300e6, 200e6);
        assertEq(uint8(r.status()), uint8(RaiseStatus.Succeeded));
        assertEq(r.accepted(), 500e6);
        assertEq(r.contributorTokens(), 5000e18);
        assertEq(usdc.balanceOf(feeTo), 5e6, "1% fee");
        assertTrue(factory.isTreasury(address(t)));
        (address predToken, address predTreasury) = factory.predictProject(1);
        assertEq(predToken, address(token));
        assertEq(predTreasury, address(t));
        assertEq(token.treasury(), address(t));
        assertEq(t.founder(), founder);
        assertEq(t.launchedAt(), block.timestamp);
        assertEq(token.balanceOf(address(r)), 5000e18);
        assertEq(amm.getPool(t.spotPoolId()).reserveQuote, 495e6 * 2000 / 10_000);
        assertEq(usdc.balanceOf(address(r)), 0, "escrow emptied, nothing to refund");

        vm.prank(alice);
        (uint256 tokens, uint256 refund) = r.claim();
        assertEq(tokens, 3000e18);
        assertEq(refund, 0);
        vm.expectRevert(AlreadyFinalized.selector);
        r.finalize();
    }

    function test_finalize_oversubscribedRefundsProRata() public {
        (Raise r,, ProjectToken token) = _launch(1500e6, 500e6); // 2000 for a 1000 cap
        assertEq(r.accepted(), 1000e6);
        vm.prank(alice);
        (uint256 aTokens, uint256 aRefund) = r.claim();
        vm.prank(bob);
        (uint256 bTokens, uint256 bRefund) = r.claim();
        assertEq(aTokens, 7500e18);
        assertEq(bTokens, 2500e18);
        assertEq(aRefund, 750e6);
        assertEq(bRefund, 250e6);
        assertEq(token.balanceOf(address(r)), 0);
        assertEq(usdc.balanceOf(address(r)), 0);
    }

    function test_claim_guards() public {
        Raise r = _create(_params());
        _contribute(alice, r, 500e6);
        vm.prank(alice);
        vm.expectRevert(NotFinalized.selector);
        r.claim();
        vm.warp(r.end());
        r.finalize();
        vm.prank(bob);
        vm.expectRevert(NothingToClaim.selector);
        r.claim();
        vm.startPrank(alice);
        r.claim();
        vm.expectRevert(AlreadyClaimed.selector);
        r.claim();
        vm.stopPrank();
        (uint256 tk, uint256 rf) = r.previewClaim(alice);
        assertEq(tk + rf, 0);
    }

    function test_noFeeRecipient_sendsWholeRaiseToTreasury() public {
        factory.setFeeRecipient(address(0));
        (Raise r, Treasury t,) = _launch(500e6, 0);
        assertEq(usdc.balanceOf(feeTo), 0);
        assertEq(usdc.balanceOf(address(t)) + amm.getPool(t.spotPoolId()).reserveQuote, r.accepted());
    }

    function test_abort_afterGraceRefunds() public {
        Raise r = _create(_params());
        _contribute(alice, r, 500e6);
        vm.warp(r.end());
        vm.expectRevert(GraceNotOver.selector);
        r.abort();
        vm.warp(uint256(r.end()) + r.finalizeGrace());
        r.abort();
        assertEq(uint8(r.status()), uint8(RaiseStatus.Failed));
        vm.prank(alice);
        (, uint256 refund) = r.claim();
        assertEq(refund, 500e6);
        vm.expectRevert(AlreadyFinalized.selector);
        r.finalize();
    }

    function test_implementationsCannotBeInitialized() public {
        Raise impl = new Raise();
        IRaiseInitArgs memory a;
        vm.expectRevert();
        impl.initialize(_toInit(a));
    }

    // ── fuzz: escrow solvency under arbitrary oversubscription ───────────────

    function testFuzz_oversubscription_solvent(uint64 a, uint64 b, uint64 c) public {
        a = uint64(bound(a, 1, 5000e6));
        b = uint64(bound(b, 1, 5000e6));
        c = uint64(bound(c, 1, 5000e6));
        vm.assume(uint256(a) + b + c >= 400e6);
        Raise r = _create(_params());
        _contribute(alice, r, a);
        _contribute(bob, r, b);
        _contribute(carol, r, c);
        vm.warp(r.end());
        r.finalize();

        address[3] memory who = [alice, bob, carol];
        uint256 refunds;
        uint256 tokens;
        for (uint256 i; i < 3; ++i) {
            vm.prank(who[i]);
            (uint256 tk, uint256 rf) = r.claim();
            tokens += tk;
            refunds += rf;
        }
        uint256 total = uint256(a) + b + c;
        assertLe(refunds, total - r.accepted(), "refunds never exceed escrow leftover");
        assertGe(refunds + 3, total - r.accepted(), "rounding dust at most 1 wei per contributor");
        assertLe(tokens, r.contributorTokens());
    }

    // helpers for the init-guard test
    struct IRaiseInitArgs {
        uint256 x;
    }

    function _toInit(IRaiseInitArgs memory) internal view returns (Raise.InitArgs memory a) {
        a.factory = address(this);
    }
}
