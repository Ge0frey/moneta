// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {MonetaAMM} from "../../src/MonetaAMM.sol";
import {IMonetaAMM} from "../../src/interfaces/IMonetaAMM.sol";
import {CPMath} from "../../src/libraries/CPMath.sol";
import {LaggingOracle} from "../../src/libraries/LaggingOracle.sol";
import "../../src/types/MonetaErrors.sol";
import {PRICE_SCALE} from "../../src/types/MonetaTypes.sol";
import {FeeOnTransferERC20, MintableERC20} from "../utils/MintableERC20.sol";
import {Test} from "forge-std/Test.sol";

contract MonetaAMMTest is Test {
    MonetaAMM amm;
    MintableERC20 base;
    MintableERC20 usdc;

    address admin = makeAddr("admin");
    address feeTo = makeAddr("feeTo");
    address owner = makeAddr("poolOwner");
    address trader = makeAddr("trader");

    uint40 constant FOREVER = type(uint40).max;

    function setUp() public {
        vm.warp(1_700_000_000);
        amm = new MonetaAMM(admin, feeTo, 3333);
        base = new MintableERC20("Lumen", "LUM", 18);
        usdc = new MintableERC20("USD Coin", "USDC", 6);

        base.mint(owner, 10_000_000e18);
        usdc.mint(owner, 10_000_000e6);
        base.mint(trader, 10_000_000e18);
        usdc.mint(trader, 10_000_000e6);

        vm.startPrank(owner);
        base.approve(address(amm), type(uint256).max);
        usdc.approve(address(amm), type(uint256).max);
        vm.stopPrank();
        vm.startPrank(trader);
        base.approve(address(amm), type(uint256).max);
        usdc.approve(address(amm), type(uint256).max);
        vm.stopPrank();
    }

    // price of 0.10 USDC per LUM in PRICE_SCALE units
    function _price(uint256 usdcPerToken6) internal pure returns (uint256) {
        return usdcPerToken6 * PRICE_SCALE / 1e18;
    }

    function _spotPool(uint128 maxStep) internal returns (uint64 id) {
        vm.prank(owner);
        id = amm.createPool(
            IMonetaAMM.PoolInit({
                base: address(base),
                quote: address(usdc),
                feeBps: 30,
                twapStart: uint40(block.timestamp),
                twapEnd: FOREVER,
                maxStepPerSecond: maxStep
            })
        );
        vm.prank(owner);
        amm.addLiquidity(id, 1_000_000e18, 100_000e6); // 0.10 USDC / LUM
    }

    function _windowPool(uint40 start, uint40 end, uint128 maxStep) internal returns (uint64 id) {
        vm.prank(owner);
        id = amm.createPool(
            IMonetaAMM.PoolInit({
                base: address(base),
                quote: address(usdc),
                feeBps: 30,
                twapStart: start,
                twapEnd: end,
                maxStepPerSecond: maxStep
            })
        );
        vm.prank(owner);
        amm.addLiquidity(id, 1_000_000e18, 100_000e6);
    }

    // ── creation ─────────────────────────────────────────────────────────────

    function test_createPool_setsFieldsAndOwner() public {
        uint64 id = _spotPool(1);
        IMonetaAMM.PoolView memory v = amm.getPool(id);
        assertEq(v.base, address(base));
        assertEq(v.quote, address(usdc));
        assertEq(v.owner, owner);
        assertEq(v.feeBps, 30);
        assertEq(v.reserveBase, 1_000_000e18);
        assertEq(v.reserveQuote, 100_000e6);
        assertEq(v.observation, _price(0.1e6));
        assertEq(amm.spotPrice(id), _price(0.1e6));
        assertEq(amm.poolCount(), 1);
    }

    function test_createPool_reverts() public {
        IMonetaAMM.PoolInit memory init = IMonetaAMM.PoolInit(address(base), address(base), 30, 0, 10, 1);
        vm.expectRevert(InvalidPool.selector);
        amm.createPool(init);
        init.quote = address(usdc);
        init.feeBps = 101;
        vm.expectRevert(FeeTooHigh.selector);
        amm.createPool(init);
        init.feeBps = 30;
        init.twapEnd = 0;
        vm.expectRevert(abi.encodeWithSelector(InvalidParam.selector, bytes32("twapWindow")));
        amm.createPool(init);
        init.base = address(0);
        vm.expectRevert(ZeroAddress.selector);
        amm.createPool(init);
    }

    // ── liquidity ────────────────────────────────────────────────────────────

    function test_addLiquidity_onlyOwner() public {
        uint64 id = _spotPool(1);
        vm.prank(trader);
        vm.expectRevert(NotPoolOwner.selector);
        amm.addLiquidity(id, 1e18, 1e6);
    }

    function test_addLiquidity_ratioMatchedKeepsPrice() public {
        uint64 id = _spotPool(1);
        uint256 priceBefore = amm.spotPrice(id);
        uint256 usdcBefore = usdc.balanceOf(owner);
        vm.prank(owner);
        (uint256 b, uint256 q) = amm.addLiquidity(id, 100_000e18, 50_000e6); // quote over-supplied
        assertEq(b, 100_000e18);
        assertEq(q, 10_000e6);
        assertEq(usdcBefore - usdc.balanceOf(owner), 10_000e6, "only matched quote pulled");
        assertEq(amm.spotPrice(id), priceBefore, "price unchanged");
    }

    function test_removeLiquidity_partialAndClose() public {
        uint64 id = _spotPool(1);
        address to = makeAddr("to");
        vm.prank(owner);
        (uint256 b, uint256 q) = amm.removeLiquidity(id, 2500, to);
        assertEq(b, 250_000e18);
        assertEq(q, 25_000e6);
        assertEq(base.balanceOf(to), b);
        assertEq(amm.spotPrice(id), _price(0.1e6));
        vm.prank(owner);
        amm.removeLiquidity(id, 10_000, to);
        assertTrue(amm.getPool(id).closed);
        vm.prank(trader);
        vm.expectRevert(PoolIsClosed.selector);
        amm.swap(id, false, 1e6, 0, trader);
        vm.prank(owner);
        vm.expectRevert(PoolIsClosed.selector);
        amm.addLiquidity(id, 1e18, 1e6);
    }

    function test_removeLiquidity_reverts() public {
        uint64 id = _spotPool(1);
        vm.prank(trader);
        vm.expectRevert(NotPoolOwner.selector);
        amm.removeLiquidity(id, 100, trader);
        vm.startPrank(owner);
        vm.expectRevert(abi.encodeWithSelector(InvalidParam.selector, bytes32("shareBps")));
        amm.removeLiquidity(id, 0, owner);
        vm.expectRevert(abi.encodeWithSelector(InvalidParam.selector, bytes32("shareBps")));
        amm.removeLiquidity(id, 10_001, owner);
        vm.stopPrank();
    }

    // ── swaps ────────────────────────────────────────────────────────────────

    function test_swap_quoteIn_matchesMathAndPaysProtocolFee() public {
        uint64 id = _spotPool(type(uint128).max);
        (uint256 expectedOut, uint256 fee) = CPMath.getAmountOut(1000e6, 100_000e6, 1_000_000e18, 30);
        (uint256 quotedOut,) = amm.quote(id, false, 1000e6);
        assertEq(quotedOut, expectedOut);

        uint256 lumBefore = base.balanceOf(trader);
        vm.prank(trader);
        uint256 out = amm.swap(id, false, 1000e6, expectedOut, trader);
        assertEq(out, expectedOut);
        assertEq(base.balanceOf(trader) - lumBefore, expectedOut);
        uint256 protocolFee = fee * 3333 / 10_000;
        assertEq(usdc.balanceOf(feeTo), protocolFee);

        IMonetaAMM.PoolView memory v = amm.getPool(id);
        assertEq(v.reserveQuote, 100_000e6 + 1000e6 - protocolFee);
        assertEq(v.reserveBase, 1_000_000e18 - expectedOut);
        assertEq(usdc.balanceOf(address(amm)), v.reserveQuote, "balances == reserves");
    }

    function test_swap_baseIn() public {
        uint64 id = _spotPool(1);
        vm.prank(trader);
        uint256 out = amm.swap(id, true, 10_000e18, 0, trader);
        assertGt(out, 0);
        assertLt(out, 1000e6, "fee + impact");
    }

    function test_swap_slippageReverts() public {
        uint64 id = _spotPool(1);
        (uint256 expectedOut,) = amm.quote(id, false, 1000e6);
        vm.prank(trader);
        vm.expectRevert(abi.encodeWithSelector(Slippage.selector, expectedOut, expectedOut + 1));
        amm.swap(id, false, 1000e6, expectedOut + 1, trader);
    }

    function test_swap_noFeeRecipientKeepsAllFeesInPool() public {
        vm.prank(admin);
        amm.setFeeRecipient(address(0));
        uint64 id = _spotPool(1);
        vm.prank(trader);
        amm.swap(id, false, 1000e6, 0, trader);
        assertEq(amm.getPool(id).reserveQuote, 101_000e6);
    }

    function test_swap_rejectedAfterWindow() public {
        uint64 id = _windowPool(uint40(block.timestamp + 10), uint40(block.timestamp + 100), 1);
        vm.warp(block.timestamp + 100);
        vm.prank(trader);
        vm.expectRevert(TradingClosed.selector);
        amm.swap(id, false, 1e6, 0, trader);
    }

    function test_swap_unknownPool() public {
        vm.expectRevert(PoolNotFound.selector);
        amm.swap(42, false, 1e6, 0, trader);
    }

    function test_feeOnTransferRejected() public {
        FeeOnTransferERC20 tax = new FeeOnTransferERC20();
        tax.mint(owner, 1000e18);
        vm.startPrank(owner);
        tax.approve(address(amm), type(uint256).max);
        uint64 id = amm.createPool(IMonetaAMM.PoolInit(address(tax), address(usdc), 30, 0, FOREVER, 1));
        vm.expectRevert(InvalidPool.selector);
        amm.addLiquidity(id, 100e18, 10e6);
        vm.stopPrank();
    }

    // ── oracle ───────────────────────────────────────────────────────────────

    function test_oracle_stepCapLimitsObservationMove() public {
        uint256 start = _price(0.1e6);
        uint128 step = uint128(start / 1000); // 0.1% of start per second
        uint64 id = _spotPool(step);

        vm.prank(trader);
        amm.swap(id, false, 50_000e6, 0, trader); // huge buy: spot jumps ~2.25x
        uint256 spot = amm.spotPrice(id);
        assertGt(spot, start * 2);

        vm.warp(block.timestamp + 10);
        amm.crank(id);
        assertEq(amm.observation(id), start + uint256(step) * 10, "moved exactly 10 steps");

        vm.warp(block.timestamp + 100_000);
        amm.crank(id);
        assertEq(amm.observation(id), spot, "converges to spot");
    }

    function test_oracle_updatesAtMostOncePerSecond() public {
        uint64 id = _spotPool(type(uint128).max);
        vm.warp(block.timestamp + 1);
        amm.crank(id);
        uint256 cum = amm.getPool(id).cumulative;
        vm.prank(trader);
        amm.swap(id, false, 10_000e6, 0, trader); // same second: no further update
        assertEq(amm.getPool(id).cumulative, cum);
        assertEq(amm.observation(id), _price(0.1e6), "same-second trade not yet observed");
    }

    function test_oracle_cumulativeOnlyInsideWindow() public {
        uint40 t0 = uint40(block.timestamp);
        uint64 id = _windowPool(t0 + 100, t0 + 200, type(uint128).max);
        vm.warp(t0 + 50);
        amm.crank(id);
        assertEq(amm.getPool(id).cumulative, 0, "warm-up not counted");
        vm.warp(t0 + 150);
        amm.crank(id);
        assertEq(amm.getPool(id).cumulative, _price(0.1e6) * 50);
        vm.warp(t0 + 500);
        amm.crank(id);
        assertEq(amm.getPool(id).cumulative, _price(0.1e6) * 100, "clipped at end");
        assertEq(amm.twap(id), _price(0.1e6));
    }

    function test_oracle_twapRevertsBeforeEnd() public {
        uint40 t0 = uint40(block.timestamp);
        uint64 id = _windowPool(t0, t0 + 100, 1);
        vm.expectRevert(TwapNotReady.selector);
        amm.twap(id);
    }

    function test_oracle_twapWithoutFinalCrankMatchesCranked() public {
        uint40 t0 = uint40(block.timestamp);
        uint64 id = _windowPool(t0, t0 + 100, type(uint128).max);
        vm.warp(t0 + 30);
        vm.prank(trader);
        amm.swap(id, false, 20_000e6, 0, trader);
        vm.warp(t0 + 60);
        amm.crank(id);
        vm.warp(t0 + 1000);
        uint256 virtualTwap = amm.twap(id);
        amm.crank(id);
        assertEq(amm.twap(id), virtualTwap);
        assertGt(virtualTwap, _price(0.1e6));
    }

    function test_oracle_twapSoFarAndCumulativeNow() public {
        uint40 t0 = uint40(block.timestamp);
        uint64 id = _windowPool(t0 + 10, t0 + 110, type(uint128).max);
        assertEq(amm.twapSoFar(id), _price(0.1e6), "before window: observation");
        vm.warp(t0 + 60);
        assertEq(amm.twapSoFar(id), _price(0.1e6));
        assertEq(amm.cumulativeNow(id), _price(0.1e6) * 50);
    }

    /// @notice End-of-window pump: a whale buys the PASS pool in the last seconds. The lagging oracle
    ///         bounds the TWAP impact to the step cap × remaining seconds.
    function test_oracle_lastSecondPumpHasBoundedImpact() public {
        uint40 t0 = uint40(block.timestamp);
        uint256 start = _price(0.1e6);
        uint128 step = uint128(start * 2 / 10_000); // 2 bps of start price per second
        uint64 id = _windowPool(t0, t0 + 3600, step);

        vm.warp(t0 + 3590);
        vm.prank(trader);
        amm.swap(id, false, 90_000e6, 0, trader); // ~3.6x spot pump with 10 seconds left
        vm.warp(t0 + 3600);
        uint256 t = amm.twap(id);
        // Observation could rise at most 10 seconds * 2 bps = 0.2%; over 1/360 of the window ⇒ tiny TWAP move.
        assertLe(t, start + start / 10_000, "twap moved < 1 bp");
    }

    /// @notice The verdict metric must not depend on keeper activity: identical trades, cranked every second vs
    ///         never cranked, give the same TWAP (up to sub-step rounding of the time-to-reach).
    function test_oracle_twapIndependentOfCrankFrequency() public {
        uint40 t0 = uint40(block.timestamp);
        uint256 start = _price(0.1e6);
        uint128 step = uint128(start / 200); // 0.5% per second
        uint64 a = _windowPool(t0 + 20, t0 + 200, step);
        uint64 b = _windowPool(t0 + 20, t0 + 200, step);

        vm.startPrank(trader);
        amm.swap(a, false, 30_000e6, 0, trader);
        amm.swap(b, false, 30_000e6, 0, trader);
        vm.stopPrank();
        for (uint256 i = 1; i <= 120; ++i) {
            vm.warp(t0 + i);
            amm.crank(a); // pool a cranked every second, pool b never
        }
        vm.warp(t0 + 120);
        vm.startPrank(trader);
        amm.swap(a, true, 200_000e18, 0, trader);
        amm.swap(b, true, 200_000e18, 0, trader);
        vm.stopPrank();
        vm.warp(t0 + 200);
        uint256 ta = amm.twap(a);
        uint256 tb = amm.twap(b);
        assertApproxEqRel(ta, tb, 1e14, "TWAP differs by < 0.01%");
        assertGt(ta, start, "the buy moved the TWAP");
    }

    function testFuzz_oracle_integralMatchesStepwiseSum(uint64 obs0, uint64 spot, uint32 rate, uint16 secs)
        public
        pure
    {
        obs0 = uint64(bound(obs0, 1e6, 1e18));
        spot = uint64(bound(spot, 1e6, 1e18));
        rate = uint32(bound(rate, 1, 1e9));
        secs = uint16(bound(secs, 1, 2000));
        uint256 closed = LaggingOracle.integral(obs0, spot, rate, 0, secs);
        // reference: per-second right-continuous sum of the trajectory is within one step·second per... bounds
        uint256 lower;
        uint256 upper;
        for (uint256 u; u < secs; ++u) {
            uint256 o1 = LaggingOracle.observationAt(obs0, spot, rate, u);
            uint256 o2 = LaggingOracle.observationAt(obs0, spot, rate, u + 1);
            (uint256 lo, uint256 hi) = o1 < o2 ? (o1, o2) : (o2, o1);
            lower += lo;
            upper += hi;
        }
        assertGe(closed + rate, lower);
        assertLe(closed, upper + rate);
    }

    // ── admin ────────────────────────────────────────────────────────────────

    function test_admin_feeShareCappedAndOwnerOnly() public {
        vm.prank(trader);
        vm.expectRevert();
        amm.setProtocolFeeShareBps(100);
        vm.prank(admin);
        vm.expectRevert(FeeTooHigh.selector);
        amm.setProtocolFeeShareBps(5001);
        vm.prank(admin);
        amm.setProtocolFeeShareBps(5000);
        assertEq(amm.protocolFeeShareBps(), 5000);
    }

    // ── fuzz ─────────────────────────────────────────────────────────────────

    function testFuzz_swap_kNeverDecreases(uint256 amountIn, bool baseIn) public {
        uint64 id = _spotPool(1);
        amountIn = baseIn ? bound(amountIn, 1e12, 5_000_000e18) : bound(amountIn, 1e3, 5_000_000e6);
        IMonetaAMM.PoolView memory b4 = amm.getPool(id);
        uint256 kBefore = uint256(b4.reserveBase) * b4.reserveQuote;
        vm.prank(trader);
        try amm.swap(id, baseIn, amountIn, 0, trader) {
            IMonetaAMM.PoolView memory af = amm.getPool(id);
            assertGe(uint256(af.reserveBase) * af.reserveQuote, kBefore);
            assertEq(base.balanceOf(address(amm)), af.reserveBase);
            assertEq(usdc.balanceOf(address(amm)), af.reserveQuote);
        } catch (bytes memory err) {
            assertEq(bytes4(err), ZeroAmount.selector, "only dust swaps may revert");
        }
    }

    function testFuzz_oracle_stepBound(uint256 buy, uint32 dt) public {
        uint256 start = _price(0.1e6);
        uint128 step = uint128(start / 500);
        uint64 id = _spotPool(step);
        buy = bound(buy, 1e6, 1_000_000e6);
        dt = uint32(bound(dt, 1, 1_000_000));
        vm.prank(trader);
        amm.swap(id, false, buy, 0, trader);
        vm.warp(block.timestamp + dt);
        amm.crank(id);
        uint256 obs = amm.observation(id);
        uint256 maxMove = uint256(step) * dt;
        assertLe(obs > start ? obs - start : start - obs, maxMove);
        assertLe(obs, amm.spotPrice(id));
    }
}
