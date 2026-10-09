// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {MonetaFactory} from "../src/MonetaFactory.sol";
import {MonetaUSDC} from "../src/local/MonetaUSDC.sol";
import {Script, console2} from "forge-std/Script.sol";
import {VmSafe} from "forge-std/Vm.sol";

/// @title TestQuote
/// @notice Adds the open-mint test quote (mUSDC) to a live Moneta deployment, next to its primary quote:
///         deploys it unless the address book already records a live one, allowlists it on the factory, and writes
///         it to `deployments/<chainId>.json` as `testQuote`. No protocol contract is redeployed. Idempotent.
/// @dev The broadcaster must be the factory owner (the deployer, unless ownership was handed to a Safe).
contract TestQuote is Script {
    string internal constant NAME = "Moneta Test USDC";
    string internal constant SYMBOL = "mUSDC";

    function run() external returns (address token) {
        string memory path =
            string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), ".json");
        string memory json = vm.readFile(path);
        MonetaFactory factory = MonetaFactory(vm.parseJsonAddress(json, ".factory"));
        require(address(factory).code.length > 0, "factory has no code: deploy Moneta first");
        if (vm.keyExistsJson(json, ".testQuote")) token = vm.parseJsonAddress(json, ".testQuote");

        vm.startBroadcast();
        (, address sender,) = vm.readCallers();
        require(factory.owner() == sender, "broadcaster is not the factory owner");
        if (token.code.length == 0) token = address(new MonetaUSDC(NAME, SYMBOL));
        if (!factory.quoteAllowed(token)) factory.setQuoteAllowed(token, true);
        vm.stopBroadcast();

        require(factory.quoteAllowed(token), "test quote allowlisted");
        require(keccak256(bytes(MonetaUSDC(token).symbol())) == keccak256(bytes(SYMBOL)), "test quote symbol");
        require(MonetaUSDC(token).decimals() == 6, "test quote decimals");

        // Only a real broadcast may write the address book (see Deploy._write).
        bool broadcasting = vm.isContext(VmSafe.ForgeContext.ScriptBroadcast)
            || vm.isContext(VmSafe.ForgeContext.ScriptResume);
        if (broadcasting) {
            vm.serializeJson("deployment", json);
            vm.writeJson(vm.serializeAddress("deployment", "testQuote", token), path);
        }
        console2.log("Test quote (mUSDC) on chain", block.chainid);
        console2.log("  testQuote", token);
        console2.log(broadcasting ? "  written  " : "  dry run, not written:", path);
    }
}
