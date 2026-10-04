// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {MonetaDeployer} from "../../script/lib/MonetaDeployer.sol";
import {ConditionalVault} from "../../src/ConditionalVault.sol";
import {MonetaAMM} from "../../src/MonetaAMM.sol";
import {MonetaFactory} from "../../src/MonetaFactory.sol";
import {MonetaRouter} from "../../src/MonetaRouter.sol";
import {ProjectToken} from "../../src/ProjectToken.sol";
import {Raise} from "../../src/Raise.sol";
import {Treasury} from "../../src/Treasury.sol";
import {MonetaUSDC} from "../../src/local/MonetaUSDC.sol";
import "../../src/types/MonetaTypes.sol";
import {Fixtures} from "./Fixtures.sol";
import {Test} from "forge-std/Test.sol";

/// @notice Full-system fixture: the real deployment (MonetaDeployer) + MonetaUSDC + funded actors.
abstract contract MonetaTestBase is Test {
    MonetaAMM amm;
    ConditionalVault vault;
    MonetaFactory factory;
    MonetaRouter router;
    MonetaUSDC usdc;

    address feeTo = makeAddr("feeTo");
    address founder = makeAddr("founder");
    address alice;
    uint256 aliceKey;
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address dave = makeAddr("dave");

    PermitArgs noPermit;

    function setUp() public virtual {
        vm.warp(1_700_000_000);
        (alice, aliceKey) = makeAddrAndKey("alice");
        usdc = new MonetaUSDC();
        MonetaDeployer.Deployment memory d = MonetaDeployer.deploy(
            MonetaDeployer.Config({
                owner: address(this),
                feeRecipient: feeTo,
                raiseFeeBps: 100,
                poolFeeBps: 30,
                protocolFeeShareBps: 3333,
                bounds: Fixtures.bounds(),
                quote: address(usdc)
            })
        );
        amm = d.amm;
        vault = d.vault;
        factory = d.factory;
        router = d.router;

        address[5] memory people = [founder, alice, bob, carol, dave];
        for (uint256 i; i < people.length; ++i) {
            usdc.mint(people[i], 100_000e6);
            vm.startPrank(people[i]);
            usdc.approve(address(router), type(uint256).max);
            usdc.approve(address(vault), type(uint256).max);
            vm.stopPrank();
        }
    }

    // ── raise helpers ────────────────────────────────────────────────────────

    function _params() internal view returns (RaiseParams memory p) {
        uint16[] memory tranches = new uint16[](4);
        tranches[0] = 2500;
        tranches[1] = 2500;
        tranches[2] = 2500;
        tranches[3] = 2000;
        p.name = "Lumen";
        p.symbol = "LUM";
        p.quote = address(usdc);
        p.founder = founder;
        p.price = 0.1e6;
        p.minRaise = 400e6;
        p.maxRaise = 1000e6;
        p.start = uint40(block.timestamp);
        p.end = uint40(block.timestamp + 600);
        p.liquidityBps = 2000;
        p.budgetPerMonth = 30e6;
        p.trancheBps = tranches;
        p.gov = Fixtures.gov();
    }

    function _create(RaiseParams memory p) internal returns (Raise r) {
        vm.prank(founder);
        (, address raise) = factory.createRaise(p, "# Lumen\nA project worth funding.");
        r = Raise(raise);
    }

    function _contribute(address who, Raise r, uint256 amount) internal {
        vm.startPrank(who);
        usdc.approve(address(r), amount);
        r.contribute(amount);
        vm.stopPrank();
    }

    /// @dev create → contributions → finalize. Returns the launched project.
    function _launch(uint256 aliceAmt, uint256 bobAmt)
        internal
        returns (Raise r, Treasury t, ProjectToken token)
    {
        r = _create(_params());
        if (aliceAmt > 0) _contribute(alice, r, aliceAmt);
        if (bobAmt > 0) _contribute(bob, r, bobAmt);
        vm.warp(r.end());
        r.finalize();
        t = Treasury(r.treasury());
        token = ProjectToken(r.token());
        address[5] memory people = [founder, alice, bob, carol, dave];
        for (uint256 i; i < people.length; ++i) {
            vm.prank(people[i]);
            usdc.approve(address(t), type(uint256).max);
        }
    }

    function _claimAll(Raise r) internal {
        if (r.contributionOf(alice) > 0) {
            vm.prank(alice);
            r.claim();
        }
        if (r.contributionOf(bob) > 0) {
            vm.prank(bob);
            r.claim();
        }
    }

    // ── market helpers ───────────────────────────────────────────────────────

    function _buy(address who, Treasury t, uint256 id, bool pass, uint256 quoteIn)
        internal
        returns (uint256 out)
    {
        vm.prank(who);
        out = router.buyOutcome(address(t), id, pass, quoteIn, 0, noPermit);
    }

    function _finalizeAfterWindow(Treasury t, uint256 id) internal {
        vm.warp(t.proposal(id).tradingEnd);
        t.finalizeProposal(id);
    }

    function _permitSig(uint256 key, address owner, address spender, uint256 value, uint256 deadline)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
                ),
                owner,
                spender,
                value,
                usdc.nonces(owner),
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash));
        (v, r, s) = vm.sign(key, digest);
    }
}
