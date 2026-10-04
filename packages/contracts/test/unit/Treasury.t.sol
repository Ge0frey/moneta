// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ConditionalToken} from "../../src/ConditionalToken.sol";
import {ConditionalVault} from "../../src/ConditionalVault.sol";
import {MonetaAMM} from "../../src/MonetaAMM.sol";
import {ProjectToken} from "../../src/ProjectToken.sol";
import {Treasury} from "../../src/Treasury.sol";
import {IMonetaAMM} from "../../src/interfaces/IMonetaAMM.sol";
import {ITreasury} from "../../src/interfaces/ITreasury.sol";
import {MonetaUSDC} from "../../src/local/MonetaUSDC.sol";
import "../../src/types/MonetaErrors.sol";
import "../../src/types/MonetaTypes.sol";
import {Fixtures} from "../utils/Fixtures.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Test} from "forge-std/Test.sol";

/// @dev Stands in for MonetaFactory: exposes poolFeeBps/bounds and initializes clones (msg.sender == factory).
contract MinimalFactory {
    Bounds internal _bounds;

    constructor() {
        _bounds = Fixtures.bounds();
    }

    function poolFeeBps() external pure returns (uint16) {
        return 30;
    }

    function bounds() external view returns (Bounds memory) {
        return _bounds;
    }

    function init(Treasury t, ITreasury.InitArgs calldata a) external {
        t.initialize(a);
    }
}

/// @dev Arbitrary call target for Call-action tests.
contract CallTarget {
    uint256 public value;
    address public treasury;

    function set(uint256 v) external {
        value = v;
    }

    function boom() external pure {
        revert("boom");
    }

    function reenter(Treasury t) external {
        PermitArgs memory none;
        t.propose(ActionType.Redeem, "", "", none);
    }
}

contract TreasuryTest is Test {
    MonetaAMM amm;
    ConditionalVault vault;
    MonetaUSDC usdc;
    MinimalFactory factory;
    ProjectToken token;
    Treasury treasury;

    address founder = makeAddr("founder");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address feeTo = makeAddr("feeTo");
    address routerStub = makeAddr("router");

    uint128 constant PRICE = 0.1e6; // 0.10 USDC per LUM
    uint256 constant ACCEPTED = 1000e6;
    uint256 constant NET = 990e6; // after 1% fee
    uint256 constant LIQ_QUOTE = 198e6; // 20% of net
    uint256 constant CONTRIB_TOKENS = 10_000e18;
    uint128 constant BOND = 1e6;
    PermitArgs noPermit;

    function setUp() public {
        vm.warp(1_700_000_000);
        amm = new MonetaAMM(address(this), feeTo, 3333);
        vault = new ConditionalVault(address(new ConditionalToken()));
        vault.initialize(address(amm), routerStub);
        usdc = new MonetaUSDC();
        factory = new MinimalFactory();

        token = ProjectToken(Clones.clone(address(new ProjectToken())));
        treasury = Treasury(Clones.clone(address(new Treasury())));
        token.initialize("Lumen", "LUM", address(treasury));

        uint16[] memory tranches = new uint16[](4);
        tranches[0] = 2500;
        tranches[1] = 2500;
        tranches[2] = 2500;
        tranches[3] = 2000;
        PerfTranche[] memory perf = new PerfTranche[](2);
        perf[0] = PerfTranche({multipleX100: 200, amount: 1000e18});
        perf[1] = PerfTranche({multipleX100: 400, amount: 1000e18});

        factory.init(
            treasury,
            ITreasury.InitArgs({
                projectId: 1,
                factory: address(factory),
                token: address(token),
                quote: address(usdc),
                amm: address(amm),
                vault: address(vault),
                raise: address(this),
                config: ProjectConfig({
                    name: "Lumen",
                    symbol: "LUM",
                    founder: founder,
                    budgetPerMonth: 30e6,
                    trancheBps: tranches,
                    perf: perf,
                    perfCliff: 300,
                    perfUnlockWindow: 120,
                    gov: Fixtures.gov()
                })
            })
        );

        usdc.mint(address(treasury), NET);
        treasury.launch(CONTRIB_TOKENS, LIQ_QUOTE, PRICE);

        // distribute contributor tokens (we are the "raise")
        IERC20(address(token)).transfer(alice, 6000e18);
        IERC20(address(token)).transfer(bob, 4000e18);

        address[4] memory people = [founder, alice, bob, carol];
        for (uint256 i; i < people.length; ++i) {
            usdc.mint(people[i], 10_000e6);
            vm.startPrank(people[i]);
            usdc.approve(address(treasury), type(uint256).max);
            usdc.approve(address(vault), type(uint256).max);
            vm.stopPrank();
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    function _proposeTranche(uint8 idx) internal returns (uint256 id) {
        vm.prank(founder);
        id = treasury.propose(ActionType.TrancheRelease, abi.encode(idx), "Milestone shipped", noPermit);
    }

    /// @dev Trader buys `side` with `quoteIn` USDC: split → swap side's quote into side's token.
    function _buy(address trader, uint256 id, bool pass, uint256 quoteIn) internal {
        Proposal memory p = treasury.proposal(id);
        vm.startPrank(trader);
        vault.split(p.conditionId, address(usdc), quoteIn, trader);
        amm.swap(pass ? p.passPoolId : p.failPoolId, false, quoteIn, 0, trader);
        vm.stopPrank();
    }

    function _toEnd(uint256 id) internal {
        vm.warp(treasury.proposal(id).tradingEnd);
    }

    // ── launch ───────────────────────────────────────────────────────────────

    function test_launch_seedsSpotAtRaisePriceAndFixesTranches() public view {
        uint64 spot = treasury.spotPoolId();
        IMonetaAMM.PoolView memory v = amm.getPool(spot);
        assertEq(v.owner, address(treasury));
        assertEq(v.reserveQuote, LIQ_QUOTE);
        assertEq(v.reserveBase, 1980e18);
        assertEq(amm.spotPrice(spot), uint256(PRICE) * PRICE_SCALE / TOKEN_UNIT);
        Tranche[] memory t = treasury.tranches();
        assertEq(t[0].amount, (NET - LIQ_QUOTE) * 2500 / 10_000);
        assertEq(t[3].amount, (NET - LIQ_QUOTE) * 2000 / 10_000);
        assertEq(token.totalSupply(), CONTRIB_TOKENS + 1980e18);
        assertEq(treasury.raisePrice(), PRICE);
    }

    function test_launch_onlyRaiseOnce() public {
        vm.prank(alice);
        vm.expectRevert(Unauthorized.selector);
        treasury.launch(1, 1, 1);
        vm.expectRevert(AlreadyLaunched.selector);
        treasury.launch(1, 1, 1);
    }

    // ── propose / activate ───────────────────────────────────────────────────

    function test_propose_activatesMarketsWithMigratedLiquidity() public {
        uint256 spotQuoteBefore = amm.getPool(treasury.spotPoolId()).reserveQuote;
        uint256 id = _proposeTranche(0);
        Proposal memory p = treasury.proposal(id);

        assertEq(uint8(p.status), uint8(ProposalStatus.Active));
        assertEq(p.thetaBps, 0);
        assertTrue(p.isTeam);
        assertEq(p.migratedQuote, spotQuoteBefore / 2);
        assertEq(p.tradingStart, block.timestamp + 30);
        assertEq(p.tradingEnd, block.timestamp + 30 + 180);
        assertEq(treasury.activeProposalId(), id);
        assertEq(treasury.bondsHeld(), BOND);

        IMonetaAMM.PoolView memory pass = amm.getPool(p.passPoolId);
        IMonetaAMM.PoolView memory fail = amm.getPool(p.failPoolId);
        assertEq(pass.reserveQuote, p.migratedQuote);
        assertEq(fail.reserveBase, p.migratedBase);
        assertEq(amm.spotPrice(p.passPoolId), amm.spotPrice(treasury.spotPoolId()), "opens at spot");
        assertEq(IERC20(pass.base).balanceOf(address(amm)), p.migratedBase);
    }

    function test_propose_validationAndSlot() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(InvalidAction.selector, uint8(1)));
        treasury.propose(ActionType.TrancheRelease, abi.encode(uint8(0)), "", noPermit);
        vm.prank(founder);
        vm.expectRevert(abi.encodeWithSelector(InvalidAction.selector, uint8(2)));
        treasury.propose(ActionType.TrancheRelease, abi.encode(uint8(9)), "", noPermit);

        _proposeTranche(0);
        vm.prank(alice);
        vm.expectRevert(SlotBusy.selector);
        treasury.propose(ActionType.SetBudget, abi.encode(uint128(1)), "", noPermit);
    }

    function test_propose_forbiddenCallTargets() public {
        address[5] memory bad =
            [address(treasury), address(vault), address(amm), address(token), address(factory)];
        for (uint256 i; i < bad.length; ++i) {
            vm.prank(alice);
            vm.expectRevert(abi.encodeWithSelector(InvalidAction.selector, uint8(7)));
            treasury.propose(ActionType.Call, abi.encode(bad[i], ""), "", noPermit);
        }
    }

    function test_propose_mintCap() public {
        uint256 cap = token.totalSupply() * 2000 / 10_000;
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(InvalidAction.selector, uint8(6)));
        treasury.propose(ActionType.Mint, abi.encode(alice, cap + 1), "", noPermit);
    }

    function test_propose_memoTooLarge() public {
        bytes memory big = new bytes(16_385);
        vm.prank(founder);
        vm.expectRevert(abi.encodeWithSelector(MemoTooLarge.selector, 16_385, 16_384));
        treasury.propose(ActionType.TrancheRelease, abi.encode(uint8(0)), string(big), noPermit);
    }

    // ── verdicts ─────────────────────────────────────────────────────────────

    function test_pass_releasesTrancheRefundsBondRestoresLiquidity() public {
        uint256 id = _proposeTranche(1);
        _buy(alice, id, true, 300e6); // strong PASS demand during warm-up
        _toEnd(id);

        uint256 founderBefore = usdc.balanceOf(founder);
        uint256 tranche = treasury.tranches()[1].amount;
        treasury.finalizeProposal(id);

        Proposal memory p = treasury.proposal(id);
        assertEq(uint8(p.status), uint8(ProposalStatus.Executed));
        assertGt(p.twapPass, p.twapFail);
        assertTrue(treasury.tranches()[1].released);
        assertEq(usdc.balanceOf(founder) - founderBefore, tranche + BOND, "tranche + bond refund");
        assertEq(treasury.bondsHeld(), 0);
        assertEq(treasury.activeProposalId(), 0);
        assertEq(uint8(vault.outcomeOf(p.conditionId)), uint8(Outcome.Pass));
        assertTrue(amm.getPool(p.passPoolId).closed);
        assertTrue(amm.getPool(p.failPoolId).closed);
        assertGt(amm.getPool(treasury.spotPoolId()).reserveQuote, 0);

        // alice holds pLUM → redeems to real LUM; her fUSDC is worthless
        uint256 lumBefore = token.balanceOf(alice);
        vm.prank(alice);
        uint256 got = vault.redeem(p.conditionId, address(token), alice);
        assertGt(got, 0);
        assertEq(token.balanceOf(alice) - lumBefore, got);
    }

    function test_fail_keepsCapitalAndForfeitsBond() public {
        uint256 id = _proposeTranche(0);
        _buy(bob, id, false, 300e6);
        _toEnd(id);
        uint256 treasuryUsdcBefore = usdc.balanceOf(address(treasury));
        treasury.finalizeProposal(id);

        Proposal memory p = treasury.proposal(id);
        assertEq(uint8(p.status), uint8(ProposalStatus.Failed));
        assertFalse(treasury.tranches()[0].released);
        assertEq(treasury.bondsHeld(), 0);
        // bond stays as treasury funds; restored liquidity leftovers may add more
        assertGe(usdc.balanceOf(address(treasury)), treasuryUsdcBefore);
        assertEq(uint8(vault.outcomeOf(p.conditionId)), uint8(Outcome.Fail));
    }

    function test_thresholds_trancheZeroPassesOnTie_communityNeedsPremium() public {
        uint256 id = _proposeTranche(0); // θ = 0, no trades → tie
        _toEnd(id);
        treasury.finalizeProposal(id);
        assertEq(uint8(treasury.proposal(id).status), uint8(ProposalStatus.Executed), "tie passes at 0");

        vm.prank(alice);
        uint256 id2 = treasury.propose(ActionType.SetBudget, abi.encode(uint128(1e6)), "", noPermit); // θ = +3%
        _toEnd(id2);
        treasury.finalizeProposal(id2);
        assertEq(uint8(treasury.proposal(id2).status), uint8(ProposalStatus.Failed), "tie fails at +3%");
    }

    function test_finalize_guards() public {
        uint256 id = _proposeTranche(0);
        vm.expectRevert(TooEarly.selector);
        treasury.finalizeProposal(id);
        _toEnd(id);
        treasury.finalizeProposal(id);
        vm.expectRevert(NotActive.selector);
        treasury.finalizeProposal(id);
    }

    function test_projectedVerdictTracksMarkets() public {
        uint256 id = _proposeTranche(0);
        _buy(bob, id, false, 200e6);
        vm.warp(block.timestamp + 120);
        (bool passing, uint256 tP, uint256 tF) = treasury.projectedVerdict(id);
        assertFalse(passing);
        assertLt(tP, tF);
    }

    // ── execution failure & retry ────────────────────────────────────────────

    function test_executionFailure_isRetryableWithinGrace() public {
        // community Transfer of more USDC than the treasury holds
        uint256 tooMuch = usdc.balanceOf(address(treasury)) + 1000e6;
        vm.prank(alice);
        uint256 id = treasury.propose(
            ActionType.Transfer, abi.encode(address(usdc), carol, tooMuch), "grant", noPermit
        );
        _buy(alice, id, true, 300e6);
        _toEnd(id);

        vm.expectEmit(true, false, false, false, address(treasury));
        emit ITreasury.ProposalExecutionFailed(id, "");
        treasury.finalizeProposal(id);
        assertEq(uint8(treasury.proposal(id).status), uint8(ProposalStatus.Passed));

        vm.expectRevert();
        treasury.executeProposal(id);

        usdc.mint(address(treasury), tooMuch); // treasury receives funds later
        treasury.executeProposal(id);
        assertEq(uint8(treasury.proposal(id).status), uint8(ProposalStatus.Executed));
        assertEq(usdc.balanceOf(carol), 10_000e6 + tooMuch);
    }

    function test_executionRetry_expires() public {
        vm.prank(alice);
        uint256 id =
            treasury.propose(ActionType.Transfer, abi.encode(address(usdc), carol, 1e30), "", noPermit);
        _buy(alice, id, true, 300e6);
        _toEnd(id);
        treasury.finalizeProposal(id);
        vm.warp(block.timestamp + 601);
        vm.expectRevert(ExecutionExpired.selector);
        treasury.executeProposal(id);
    }

    // ── actions ──────────────────────────────────────────────────────────────

    function test_action_call_executesAndReentrancyIsBlocked() public {
        CallTarget target = new CallTarget();
        vm.prank(alice);
        uint256 id = treasury.propose(
            ActionType.Call, abi.encode(address(target), abi.encodeCall(CallTarget.set, (42))), "", noPermit
        );
        _buy(alice, id, true, 300e6);
        _toEnd(id);
        treasury.finalizeProposal(id);
        assertEq(target.value(), 42);
        assertEq(uint8(treasury.proposal(id).status), uint8(ProposalStatus.Executed));

        vm.prank(alice);
        uint256 id2 = treasury.propose(
            ActionType.Call,
            abi.encode(address(target), abi.encodeCall(CallTarget.reenter, (treasury))),
            "",
            noPermit
        );
        _buy(alice, id2, true, 300e6);
        _toEnd(id2);
        treasury.finalizeProposal(id2);
        assertEq(
            uint8(treasury.proposal(id2).status), uint8(ProposalStatus.Passed), "reentrant call failed safely"
        );
    }

    function test_action_budget_streamsAndSetBudgetSettlesFirst() public {
        vm.warp(block.timestamp + 15 days);
        assertEq(treasury.budgetAccrued(), 15e6);
        vm.prank(alice);
        vm.expectRevert(NotFounder.selector);
        treasury.claimBudget();
        uint256 before = usdc.balanceOf(founder);
        vm.prank(founder);
        treasury.claimBudget();
        assertEq(usdc.balanceOf(founder) - before, 15e6);

        vm.warp(block.timestamp + 10 days);
        vm.prank(alice);
        uint256 id = treasury.propose(ActionType.SetBudget, abi.encode(uint128(0)), "", noPermit);
        _buy(alice, id, true, 300e6);
        _toEnd(id);
        before = usdc.balanceOf(founder);
        treasury.finalizeProposal(id);
        assertApproxEqAbs(
            usdc.balanceOf(founder) - before,
            10e6 + uint256(30e6) * 210 / 30 days,
            1,
            "accrued paid before rate change"
        );
        assertEq(treasury.budgetPerMonth(), 0);
    }

    function test_action_buybackBurns() public {
        uint256 supplyBefore = token.totalSupply();
        vm.prank(alice);
        uint256 id = treasury.propose(ActionType.Buyback, abi.encode(uint256(50e6), uint256(0)), "", noPermit);
        _buy(alice, id, true, 300e6);
        _toEnd(id);
        treasury.finalizeProposal(id);
        assertEq(uint8(treasury.proposal(id).status), uint8(ProposalStatus.Executed));
        assertLt(token.totalSupply(), supplyBefore);
    }

    function test_action_mintAndSetFounderAndUpdateConfig() public {
        vm.prank(alice);
        uint256 id = treasury.propose(ActionType.Mint, abi.encode(carol, uint256(100e18)), "", noPermit);
        _buy(alice, id, true, 300e6);
        _toEnd(id);
        treasury.finalizeProposal(id);
        assertEq(token.balanceOf(carol), 100e18);

        vm.prank(alice);
        id = treasury.propose(ActionType.SetFounder, abi.encode(carol), "", noPermit);
        _buy(alice, id, true, 300e6);
        _toEnd(id);
        treasury.finalizeProposal(id);
        assertEq(treasury.founder(), carol);

        GovConfig memory c = Fixtures.gov();
        c.duration = 600;
        vm.prank(alice);
        id = treasury.propose(ActionType.UpdateConfig, abi.encode(c), "", noPermit);
        _buy(alice, id, true, 300e6);
        _toEnd(id);
        treasury.finalizeProposal(id);
        assertEq(treasury.config().duration, 600);

        c.duration = 1; // below bounds
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(InvalidParam.selector, bytes32("duration")));
        treasury.propose(ActionType.UpdateConfig, abi.encode(c), "", noPermit);
    }

    // ── redemption ───────────────────────────────────────────────────────────

    function test_redemption_queuesBehindActiveThenPaysProRata() public {
        uint256 tid = _proposeTranche(0);
        vm.prank(bob);
        uint256 rid = treasury.propose(ActionType.Redeem, "", "wind down", noPermit);
        assertEq(uint8(treasury.proposal(rid).status), uint8(ProposalStatus.Queued));
        assertEq(treasury.queuedRedemptionId(), rid);

        vm.prank(carol);
        vm.expectRevert(RedemptionQueued.selector);
        treasury.propose(ActionType.Redeem, "", "", noPermit);

        _buy(bob, tid, false, 300e6);
        _toEnd(tid);
        treasury.finalizeProposal(tid); // FAIL → queued redemption activates automatically
        assertEq(uint8(treasury.proposal(tid).status), uint8(ProposalStatus.Failed));
        assertEq(treasury.activeProposalId(), rid);
        assertEq(uint8(treasury.proposal(rid).status), uint8(ProposalStatus.Active));

        _buy(alice, rid, true, 500e6);
        _toEnd(rid);
        treasury.finalizeProposal(rid);
        assertEq(uint8(treasury.state()), uint8(ProjectState.Redeemed));
        assertEq(uint8(treasury.proposal(rid).status), uint8(ProposalStatus.Executed));
        assertTrue(amm.getPool(treasury.spotPoolId()).closed);
        assertEq(token.balanceOf(address(treasury)), 0);

        uint256 pool = treasury.redemptionQuote();
        uint256 supply = treasury.redemptionSupply();
        uint256 bobTokens = token.balanceOf(bob);
        uint256 before = usdc.balanceOf(bob);
        vm.prank(bob);
        uint256 paid = treasury.redeem(bobTokens);
        assertEq(paid, bobTokens * pool / supply);
        assertEq(usdc.balanceOf(bob) - before, paid);

        vm.prank(alice);
        vm.expectRevert(ProjectRedeemed.selector);
        treasury.propose(ActionType.SetBudget, abi.encode(uint128(1)), "", noPermit);
        vm.prank(founder);
        vm.expectRevert(ProjectRedeemed.selector);
        treasury.claimBudget();
    }

    function test_redemption_notQueueableBehindRedemption() public {
        vm.prank(bob);
        treasury.propose(ActionType.Redeem, "", "", noPermit);
        vm.prank(carol);
        vm.expectRevert(SlotBusy.selector);
        treasury.propose(ActionType.Redeem, "", "", noPermit);
    }

    function test_redeem_requiresRedeemedState() public {
        vm.prank(alice);
        vm.expectRevert(NotRedeemed.selector);
        treasury.redeem(1e18);
    }

    // ── performance package ──────────────────────────────────────────────────

    function test_perf_cliffTargetAndUnlock() public {
        vm.prank(founder);
        vm.expectRevert(TooEarly.selector);
        treasury.startPerformanceUnlock(0);

        vm.warp(block.timestamp + 301);
        vm.prank(founder);
        vm.expectPartialRevert(TargetNotMet.selector);
        treasury.startPerformanceUnlock(0);

        // pump spot well above 2x and let the lagging observation catch up
        uint64 spot = treasury.spotPoolId();
        vm.startPrank(carol);
        usdc.approve(address(amm), type(uint256).max);
        amm.swap(spot, false, 400e6, 0, carol);
        vm.stopPrank();
        vm.warp(block.timestamp + 300);
        amm.crank(spot);

        vm.prank(founder);
        treasury.startPerformanceUnlock(0);
        vm.prank(founder);
        vm.expectRevert(TooEarly.selector);
        treasury.completePerformanceUnlock(0);

        vm.warp(block.timestamp + 120);
        vm.prank(founder);
        treasury.completePerformanceUnlock(0);
        assertEq(token.balanceOf(founder), 1000e18);

        vm.prank(founder);
        vm.expectRevert(AlreadyUnlocked.selector);
        treasury.completePerformanceUnlock(0);
    }

    // ── views ────────────────────────────────────────────────────────────────

    function test_nav_reflectsTreasuryAndPol() public view {
        (uint256 assets, uint256 circulating, uint256 navPerToken) = treasury.nav();
        assertEq(assets, NET, "792 treasury + 198 POL quote");
        assertEq(circulating, CONTRIB_TOKENS);
        assertEq(navPerToken, NET * 1e18 / CONTRIB_TOKENS);
    }
}
