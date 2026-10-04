// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ConditionalToken} from "../../src/ConditionalToken.sol";
import {ConditionalVault} from "../../src/ConditionalVault.sol";
import {IConditionalVault} from "../../src/interfaces/IConditionalVault.sol";
import "../../src/types/MonetaErrors.sol";
import {Outcome} from "../../src/types/MonetaTypes.sol";
import {FeeOnTransferERC20, MintableERC20} from "../utils/MintableERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Test} from "forge-std/Test.sol";

contract ConditionalVaultTest is Test {
    ConditionalVault vault;
    MintableERC20 usdc;
    MintableERC20 lum;

    address resolver = makeAddr("treasury");
    address amm = makeAddr("amm");
    address router = makeAddr("router");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    bytes32 cond;
    address pQ;
    address fQ;

    function setUp() public {
        vault = new ConditionalVault(address(new ConditionalToken()));
        vault.initialize(amm, router);
        usdc = new MintableERC20("USD Coin", "USDC", 6);
        lum = new MintableERC20("Lumen", "LUM", 18);

        vm.startPrank(resolver);
        cond = vault.prepareCondition(bytes32(uint256(4)));
        (pQ, fQ) = vault.prepareCollateral(cond, address(usdc), "USDC-4");
        vault.prepareCollateral(cond, address(lum), "LUM-4");
        vm.stopPrank();

        usdc.mint(alice, 1000e6);
        usdc.mint(bob, 1000e6);
        vm.prank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(vault), type(uint256).max);
    }

    function test_initialize_onlyOnceByDeployer() public {
        vm.expectRevert(AlreadyInitialized.selector);
        vault.initialize(amm, router);
        ConditionalVault v2 = new ConditionalVault(address(new ConditionalToken()));
        vm.prank(alice);
        vm.expectRevert(Unauthorized.selector);
        v2.initialize(amm, router);
    }

    function test_prepare_namesDecimalsAndNamespacing() public view {
        assertEq(IERC20Metadata(pQ).symbol(), "pUSDC-4");
        assertEq(IERC20Metadata(fQ).name(), "Moneta FAIL USDC-4");
        assertEq(IERC20Metadata(pQ).decimals(), 6);
        assertEq(vault.resolverOf(cond), resolver);
        assertEq(cond, vault.conditionIdOf(resolver, bytes32(uint256(4))));
        (address p, address f) = vault.tokensOf(cond, address(usdc));
        assertEq(p, pQ);
        assertEq(f, fQ);
    }

    function test_prepare_reverts() public {
        vm.prank(resolver);
        vm.expectRevert(ConditionExists.selector);
        vault.prepareCondition(bytes32(uint256(4)));
        vm.prank(alice);
        vm.expectRevert(Unauthorized.selector);
        vault.prepareCollateral(cond, address(usdc), "X");
        vm.prank(resolver);
        vm.expectRevert(CollateralExists.selector);
        vault.prepareCollateral(cond, address(usdc), "X");
        vm.expectRevert(ConditionNotFound.selector);
        vault.prepareCollateral(bytes32(0), address(usdc), "X");
    }

    function test_split_mintsBothSides() public {
        vm.prank(alice);
        vault.split(cond, address(usdc), 100e6, alice);
        assertEq(IERC20(pQ).balanceOf(alice), 100e6);
        assertEq(IERC20(fQ).balanceOf(alice), 100e6);
        assertEq(vault.collateralHeld(cond, address(usdc)), 100e6);
        assertEq(usdc.balanceOf(address(vault)), 100e6);
    }

    function test_merge_returnsCollateral() public {
        vm.startPrank(alice);
        vault.split(cond, address(usdc), 100e6, alice);
        vault.merge(cond, address(usdc), 40e6, bob);
        vm.stopPrank();
        assertEq(usdc.balanceOf(bob), 1040e6);
        assertEq(IERC20(pQ).balanceOf(alice), 60e6);
        assertEq(vault.collateralHeld(cond, address(usdc)), 60e6);
    }

    function test_resolve_onlyResolverOnce() public {
        vm.prank(alice);
        vm.expectRevert(Unauthorized.selector);
        vault.resolve(cond, Outcome.Pass);
        vm.startPrank(resolver);
        vm.expectRevert(InvalidOutcome.selector);
        vault.resolve(cond, Outcome.Unresolved);
        vault.resolve(cond, Outcome.Fail);
        vm.expectRevert(AlreadyResolved.selector);
        vault.resolve(cond, Outcome.Pass);
        vm.stopPrank();
        assertEq(uint8(vault.outcomeOf(cond)), uint8(Outcome.Fail));
    }

    function test_redeem_paysWinnersBurnsLosers() public {
        vm.prank(alice);
        vault.split(cond, address(usdc), 100e6, alice);
        // alice "bets" on PASS: gives her FAIL side to bob
        vm.prank(alice);
        IERC20(fQ).transfer(bob, 100e6);

        vm.prank(alice);
        vm.expectRevert(NotResolved.selector);
        vault.redeem(cond, address(usdc), alice);

        vm.prank(resolver);
        vault.resolve(cond, Outcome.Pass);

        vm.prank(alice);
        assertEq(vault.redeem(cond, address(usdc), alice), 100e6);
        vm.prank(bob);
        assertEq(vault.redeem(cond, address(usdc), bob), 0);
        assertEq(IERC20(fQ).totalSupply(), 0);
        assertEq(IERC20(pQ).totalSupply(), 0);
        assertEq(vault.collateralHeld(cond, address(usdc)), 0);
        assertEq(usdc.balanceOf(alice), 1000e6);
    }

    function test_split_blockedAfterResolution_mergeStillWorks() public {
        vm.prank(alice);
        vault.split(cond, address(usdc), 100e6, alice);
        vm.prank(resolver);
        vault.resolve(cond, Outcome.Fail);
        vm.startPrank(alice);
        vm.expectRevert(AlreadyResolved.selector);
        vault.split(cond, address(usdc), 1e6, alice);
        vault.merge(cond, address(usdc), 100e6, alice);
        vm.stopPrank();
        assertEq(usdc.balanceOf(alice), 1000e6);
    }

    function test_tokens_onlyVaultMintsBurns() public {
        vm.expectRevert(Unauthorized.selector);
        ConditionalToken(pQ).mint(alice, 1);
        vm.expectRevert(Unauthorized.selector);
        ConditionalToken(pQ).burn(alice, 1);
    }

    function test_tokens_trustedSpendersOnly() public {
        vm.prank(alice);
        vault.split(cond, address(usdc), 100e6, alice);
        assertEq(IERC20(pQ).allowance(alice, amm), type(uint256).max);
        assertEq(IERC20(pQ).allowance(alice, router), type(uint256).max);
        assertEq(IERC20(pQ).allowance(alice, bob), 0);

        vm.prank(router);
        IERC20(pQ).transferFrom(alice, router, 10e6);
        assertEq(IERC20(pQ).balanceOf(router), 10e6);

        vm.prank(bob);
        vm.expectRevert();
        IERC20(pQ).transferFrom(alice, bob, 1);
    }

    function test_implementationCannotBeInitialized() public {
        ConditionalToken impl = new ConditionalToken();
        vm.expectRevert();
        impl.initialize("x", "x", 6, address(this), amm, router);
    }

    function test_feeOnTransferCollateralRejected() public {
        FeeOnTransferERC20 tax = new FeeOnTransferERC20();
        vm.prank(resolver);
        vault.prepareCollateral(cond, address(tax), "TAX-4");
        tax.mint(alice, 100e18);
        vm.startPrank(alice);
        tax.approve(address(vault), type(uint256).max);
        vm.expectRevert(TransferAmountMismatch.selector);
        vault.split(cond, address(tax), 10e18, alice);
        vm.stopPrank();
    }

    function testFuzz_solvency(uint96 a, uint96 b, uint96 m, bool passWins) public {
        a = uint96(bound(a, 1, 1000e6));
        b = uint96(bound(b, 1, 1000e6));
        vm.prank(alice);
        vault.split(cond, address(usdc), a, alice);
        vm.prank(bob);
        vault.split(cond, address(usdc), b, bob);
        m = uint96(bound(m, 0, a));
        if (m > 0) {
            vm.prank(alice);
            vault.merge(cond, address(usdc), m, alice);
        }
        assertEq(vault.collateralHeld(cond, address(usdc)), IERC20(pQ).totalSupply());
        assertEq(IERC20(pQ).totalSupply(), IERC20(fQ).totalSupply());

        vm.prank(resolver);
        vault.resolve(cond, passWins ? Outcome.Pass : Outcome.Fail);
        vm.prank(alice);
        vault.redeem(cond, address(usdc), alice);
        vm.prank(bob);
        vault.redeem(cond, address(usdc), bob);
        assertEq(vault.collateralHeld(cond, address(usdc)), 0);
        assertEq(usdc.balanceOf(address(vault)), 0);
        assertEq(
            usdc.balanceOf(alice) + usdc.balanceOf(bob), 2000e6, "nobody lost principal by only splitting"
        );
    }
}
