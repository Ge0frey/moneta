// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {MonetaUSDC} from "../src/local/MonetaUSDC.sol";
import {Bounds} from "../src/types/MonetaTypes.sol";
import {MonetaDeployer} from "./lib/MonetaDeployer.sol";
import {Script, console2} from "forge-std/Script.sol";
import {VmSafe} from "forge-std/Vm.sol";

/// @title Deploy
/// @notice Deploys the Moneta protocol (see MonetaDeployer for the dependency-ordered wiring), asserts every
///         post-condition, hands ownership to the protocol Safe when configured, and writes
///         `deployments/<chainId>.json` for the SDK, indexer and bots.
/// @dev Env:
///        NETWORK=local|testnet
///        QUOTE_TOKEN       (testnet: Circle USDC; local: MonetaUSDC is deployed automatically)
///        FEE_RECIPIENT     (default: deployer)
///        PROTOCOL_SAFE     (default: none → deployer stays owner; Safe must acceptOwnership afterwards)
contract Deploy is Script {
    function run() external returns (MonetaDeployer.Deployment memory d) {
        string memory network = vm.envOr("NETWORK", string("local"));
        bool isLocal = keccak256(bytes(network)) == keccak256("local");
        uint256 startBlock = block.number;

        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();

        address quote = isLocal ? address(new MonetaUSDC()) : vm.envAddress("QUOTE_TOKEN");
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);
        address safe = vm.envOr("PROTOCOL_SAFE", address(0));

        d = MonetaDeployer.deploy(
            MonetaDeployer.Config({
                owner: deployer,
                feeRecipient: feeRecipient,
                raiseFeeBps: 100,
                poolFeeBps: 30,
                protocolFeeShareBps: 3333,
                bounds: testnetBounds(),
                quote: quote
            })
        );

        if (safe != address(0) && safe != deployer) {
            d.factory.transferOwnership(safe);
            d.amm.transferOwnership(safe);
        }
        vm.stopBroadcast();

        _assertPostConditions(d, quote, deployer, safe);
        _write(d, quote, network, startBlock, deployer);
    }

    /// @notice Testnet/local bounds: minute-scale windows allowed so full lifecycles run in minutes (mainnet would be strict).
    function testnetBounds() public pure returns (Bounds memory) {
        return Bounds({
            minRaiseWindow: 60,
            maxRaiseWindow: 30 days,
            maxStartDelay: 30 days,
            finalizeGrace: 600,
            minLiquidityBps: 500,
            maxLiquidityBps: 5000,
            maxTranches: 8,
            maxPerfTranches: 5,
            minWarmup: 0,
            maxWarmup: 7 days,
            minDuration: 60,
            maxDuration: 14 days,
            minProposalLiquidityBps: 1000,
            maxProposalLiquidityBps: 9000,
            minMaxStepBps: 1,
            maxMaxStepBps: 1000,
            minTheta: -500,
            maxTheta: 2000,
            minBond: 0,
            minExecutionGrace: 60,
            maxMintBps: 2000,
            maxMemoBytes: 16_384
        });
    }

    function _assertPostConditions(
        MonetaDeployer.Deployment memory d,
        address quote,
        address deployer,
        address safe
    ) internal view {
        require(d.vault.amm() == address(d.amm), "vault.amm");
        require(d.vault.router() == address(d.router), "vault.router");
        require(address(d.router.factory()) == address(d.factory), "router.factory");
        require(d.factory.vault() == address(d.vault) && d.factory.amm() == address(d.amm), "factory wiring");
        require(d.factory.quoteAllowed(quote), "quote allowlisted");
        require(d.factory.raiseFeeBps() == 100 && d.factory.poolFeeBps() == 30, "fees");
        address expectedPending = (safe != address(0) && safe != deployer) ? safe : address(0);
        require(d.factory.owner() == deployer && d.factory.pendingOwner() == expectedPending, "factory owner");
        require(d.amm.owner() == deployer && d.amm.pendingOwner() == expectedPending, "amm owner");
    }

    function _write(
        MonetaDeployer.Deployment memory d,
        address quote,
        string memory network,
        uint256 startBlock,
        address deployer
    ) internal {
        string memory k = "deployment";
        vm.serializeString(k, "network", network);
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeUint(k, "startBlock", startBlock);
        vm.serializeUint(k, "deployedAt", block.timestamp);
        vm.serializeAddress(k, "deployer", deployer);
        vm.serializeAddress(k, "quote", quote);
        vm.serializeAddress(k, "factory", address(d.factory));
        vm.serializeAddress(k, "amm", address(d.amm));
        vm.serializeAddress(k, "vault", address(d.vault));
        vm.serializeAddress(k, "router", address(d.router));
        vm.serializeAddress(k, "raiseImpl", d.raiseImpl);
        vm.serializeAddress(k, "treasuryImpl", d.treasuryImpl);
        vm.serializeAddress(k, "projectTokenImpl", d.projectTokenImpl);
        string memory json = vm.serializeAddress(k, "conditionalTokenImpl", d.conditionalTokenImpl);
        string memory path =
            string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), ".json");
        // Only a real broadcast may write the address book: a dry run's addresses (any --sender) are not deployed,
        // and an SDK regenerated from them would point every app at empty addresses.
        bool broadcasting = vm.isContext(VmSafe.ForgeContext.ScriptBroadcast)
            || vm.isContext(VmSafe.ForgeContext.ScriptResume);
        if (broadcasting) vm.writeJson(json, path);
        console2.log("Moneta deployed on chain", block.chainid);
        console2.log("  factory ", address(d.factory));
        console2.log("  amm     ", address(d.amm));
        console2.log("  vault   ", address(d.vault));
        console2.log("  router  ", address(d.router));
        console2.log("  quote   ", quote);
        console2.log(broadcasting ? "  written " : "  dry run, not written:", path);
    }
}
