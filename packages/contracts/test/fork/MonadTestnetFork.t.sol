// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {MonetaDeployer} from "../../script/lib/MonetaDeployer.sol";
import {Raise} from "../../src/Raise.sol";
import "../../src/types/MonetaTypes.sol";
import {Fixtures} from "../utils/Fixtures.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Test} from "forge-std/Test.sol";

interface IFiatToken {
    function version() external view returns (string memory);
    function decimals() external view returns (uint8);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function nonces(address) external view returns (uint256);
    function permit(address, address, uint256, uint256, uint8, bytes32, bytes32) external;
}

/// @notice Runs against Monad testnet state with REAL Circle USDC.
///         `forge test --match-path 'test/fork/*' --fork-url $MONAD_TESTNET_RPC_URL`
contract MonadTestnetForkTest is Test {
    address constant USDC = 0x534b2f3A21130d7a60830c2Df862319e593943A3;

    function setUp() public {
        if (block.chainid != 10_143) vm.skip(true);
    }

    function test_fork_circleUsdcMatchesAssumptions() public view {
        assertEq(IFiatToken(USDC).decimals(), 6);
        assertEq(IFiatToken(USDC).version(), "2", "permit domain version 2 (as MonetaUSDC)");
    }

    function _sign(uint256 key, address owner, address spender, uint256 value, uint256 deadline)
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
                IFiatToken(USDC).nonces(owner),
                deadline
            )
        );
        (v, r, s) = vm.sign(
            key, keccak256(abi.encodePacked("\x19\x01", IFiatToken(USDC).DOMAIN_SEPARATOR(), structHash))
        );
    }

    function test_fork_permitAndRaiseWithRealUsdc() public {
        (address alice, uint256 key) = makeAddrAndKey("fork-alice");
        address founder = makeAddr("fork-founder");
        deal(USDC, alice, 1000e6);

        MonetaDeployer.Deployment memory d = MonetaDeployer.deploy(
            MonetaDeployer.Config({
                owner: address(this),
                feeRecipient: makeAddr("fee"),
                raiseFeeBps: 100,
                poolFeeBps: 30,
                protocolFeeShareBps: 3333,
                bounds: Fixtures.bounds(),
                quote: USDC
            })
        );

        Raise r = _createForkRaise(d, founder);
        _contributeAndFinalize(r, alice, key);
    }

    function _createForkRaise(MonetaDeployer.Deployment memory d, address founder) internal returns (Raise) {
        uint16[] memory tranches = new uint16[](1);
        tranches[0] = 5000;
        RaiseParams memory p;
        p.name = "Fork";
        p.symbol = "FRK";
        p.quote = USDC;
        p.founder = founder;
        p.price = 0.01e6;
        p.minRaise = 40e6;
        p.maxRaise = 200e6;
        p.start = uint40(block.timestamp);
        p.end = uint40(block.timestamp + 120);
        p.liquidityBps = 2000;
        p.budgetPerMonth = 1e6;
        p.trancheBps = tranches;
        p.gov = Fixtures.gov();
        (, address raiseAddr) = d.factory.createRaise(p, "fork");
        return Raise(raiseAddr);
    }

    function _contributeAndFinalize(Raise r, address alice, uint256 key) internal {
        uint256 deadline = block.timestamp + 600;
        (uint8 v, bytes32 rs, bytes32 s) = _sign(key, alice, address(r), 100e6, deadline);
        vm.prank(alice);
        r.contributeWithPermit(100e6, deadline, v, rs, s);
        assertEq(r.contributionOf(alice), 100e6);

        vm.warp(r.end());
        r.finalize();
        assertEq(uint8(r.status()), uint8(RaiseStatus.Succeeded));
        assertGt(IERC20(USDC).balanceOf(r.treasury()), 0);
    }
}
