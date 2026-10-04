// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ConditionalVault} from "../../src/ConditionalVault.sol";
import {MonetaAMM} from "../../src/MonetaAMM.sol";
import {MonetaRouter} from "../../src/MonetaRouter.sol";
import {ProjectToken} from "../../src/ProjectToken.sol";
import {Raise} from "../../src/Raise.sol";
import {Treasury} from "../../src/Treasury.sol";
import {IMonetaAMM} from "../../src/interfaces/IMonetaAMM.sol";
import {MonetaUSDC} from "../../src/local/MonetaUSDC.sol";
import "../../src/types/MonetaTypes.sol";
import {MonetaTestBase} from "../utils/MonetaTestBase.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Test} from "forge-std/Test.sol";

/// @notice Drives random user actions against one launched project.
contract Handler is Test {
    Treasury public t;
    ProjectToken public lum;
    MonetaUSDC public usdc;
    MonetaRouter public router;
    MonetaAMM public amm;
    ConditionalVault public vault;
    address public founder;
    address[] public actors;
    uint256[] public proposalIds;
    PermitArgs noPermit;

    constructor(
        Treasury t_,
        ProjectToken lum_,
        MonetaUSDC usdc_,
        MonetaRouter router_,
        MonetaAMM amm_,
        ConditionalVault vault_,
        address founder_,
        address[] memory actors_
    ) {
        t = t_;
        lum = lum_;
        usdc = usdc_;
        router = router_;
        amm = amm_;
        vault = vault_;
        founder = founder_;
        actors = actors_;
    }

    function proposalCount() external view returns (uint256) {
        return proposalIds.length;
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function propose(uint256 seed, uint8 kind) external {
        if (t.activeProposalId() != 0 || t.state() != ProjectState.Active) return;
        address who = kind % 2 == 0 ? founder : _actor(seed);
        vm.startPrank(who);
        try t.propose(
            kind % 2 == 0 ? ActionType.TrancheRelease : ActionType.SetBudget,
            kind % 2 == 0 ? abi.encode(uint8(seed % 4)) : abi.encode(uint128(seed % 100e6)),
            "",
            noPermit
        ) returns (
            uint256 id
        ) {
            proposalIds.push(id);
        } catch {}
        vm.stopPrank();
    }

    function buy(uint256 seed, bool pass, uint256 amount) external {
        uint256 id = t.activeProposalId();
        if (id == 0) return;
        amount = bound(amount, 1e4, 200e6);
        vm.prank(_actor(seed));
        try router.buyOutcome(address(t), id, pass, amount, 0, noPermit) {} catch {}
    }

    function sell(uint256 seed, bool pass, uint256 frac) external {
        uint256 id = t.activeProposalId();
        if (id == 0) return;
        address who = _actor(seed);
        Proposal memory p = t.proposal(id);
        (address pT, address fT) = vault.tokensOf(p.conditionId, address(lum));
        uint256 bal = IERC20(pass ? pT : fT).balanceOf(who);
        if (bal == 0) return;
        vm.prank(who);
        try router.sellOutcome(address(t), id, pass, bal * bound(frac, 1, 100) / 100, 0) {} catch {}
    }

    function spot(uint256 seed, bool buySide, uint256 amount) external {
        if (t.state() != ProjectState.Active) return;
        address who = _actor(seed);
        if (buySide) {
            amount = bound(amount, 1e4, 100e6);
        } else {
            uint256 bal = lum.balanceOf(who);
            if (bal == 0) return;
            amount = bound(amount, 1, bal);
        }
        vm.startPrank(who);
        lum.approve(address(router), type(uint256).max);
        try router.swapSpot(address(t), buySide, amount, 0, noPermit) {} catch {}
        vm.stopPrank();
    }

    function warp(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 1, 120));
    }

    function finalize() external {
        uint256 id = t.activeProposalId();
        if (id == 0 || block.timestamp < t.proposal(id).tradingEnd) return;
        t.finalizeProposal(id);
    }

    function redeemPositions(uint256 seed, uint256 which) external {
        if (proposalIds.length == 0) return;
        uint256 id = proposalIds[which % proposalIds.length];
        vm.prank(_actor(seed));
        try router.redeemAll(address(t), id) {} catch {}
    }

    function claimBudget() external {
        vm.prank(founder);
        try t.claimBudget() {} catch {}
    }
}

contract MonetaInvariantTest is MonetaTestBase {
    Handler handler;
    Raise r;
    Treasury t;
    ProjectToken lum;
    uint256 usdcSupply;

    function setUp() public override {
        super.setUp();
        (r, t, lum) = _launch(600e6, 400e6);
        _claimAll(r);

        address[] memory actors = new address[](4);
        actors[0] = alice;
        actors[1] = bob;
        actors[2] = carol;
        actors[3] = dave;
        handler = new Handler(t, lum, usdc, router, amm, vault, founder, actors);
        usdcSupply = usdc.totalSupply();
        targetContract(address(handler));
    }

    /// The router never retains funds between transactions.
    function invariant_routerHoldsNothing() public view {
        assertEq(usdc.balanceOf(address(router)), 0);
        assertEq(lum.balanceOf(address(router)), 0);
    }

    /// Every condition is fully collateralised.
    function invariant_vaultSolvent() public view {
        uint256 n = handler.proposalCount();
        for (uint256 i; i < n; ++i) {
            Proposal memory p = t.proposal(handler.proposalIds(i));
            if (p.conditionId == bytes32(0)) continue;
            _checkPair(p.conditionId, address(usdc));
            _checkPair(p.conditionId, address(lum));
        }
    }

    function _checkPair(bytes32 cond, address collateral) internal view {
        (address passT, address failT) = vault.tokensOf(cond, collateral);
        uint256 held = vault.collateralHeld(cond, collateral);
        Outcome o = vault.outcomeOf(cond);
        if (o == Outcome.Unresolved) {
            assertEq(held, IERC20(passT).totalSupply());
            assertEq(held, IERC20(failT).totalSupply());
        } else {
            assertGe(held, IERC20(o == Outcome.Pass ? passT : failT).totalSupply());
        }
    }

    /// The AMM always holds at least the sum of its pools' reserves, for every token.
    function invariant_ammBalancesCoverReserves() public view {
        uint64 pools = amm.poolCount();
        uint256 usdcReserves;
        uint256 lumReserves;
        for (uint64 i = 1; i <= pools; ++i) {
            IMonetaAMM.PoolView memory v = amm.getPool(i);
            if (v.quote == address(usdc)) usdcReserves += v.reserveQuote;
            if (v.base == address(lum)) lumReserves += v.reserveBase;
            assertGe(IERC20(v.base).balanceOf(address(amm)), v.reserveBase);
            assertGe(IERC20(v.quote).balanceOf(address(amm)), v.reserveQuote);
        }
        assertGe(usdc.balanceOf(address(amm)), usdcReserves);
        assertGe(lum.balanceOf(address(amm)), lumReserves);
    }

    /// Bonds are always covered and at most one proposal is active.
    function invariant_treasuryAccounting() public view {
        assertGe(usdc.balanceOf(address(t)), t.bondsHeld());
        uint256 active = t.activeProposalId();
        if (active != 0) assertEq(uint8(t.proposal(active).status), uint8(ProposalStatus.Active));
    }

    /// USDC is never created or destroyed by the protocol.
    function invariant_usdcConserved() public view {
        assertEq(usdc.totalSupply(), usdcSupply);
    }
}
