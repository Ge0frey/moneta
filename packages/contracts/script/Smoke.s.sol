// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {MonetaFactory} from "../src/MonetaFactory.sol";
import {MonetaRouter} from "../src/MonetaRouter.sol";
import {Raise} from "../src/Raise.sol";
import {Treasury} from "../src/Treasury.sol";
import {MonetaUSDC} from "../src/local/MonetaUSDC.sol";
import "../src/types/MonetaTypes.sol";
import {Script, console2} from "forge-std/Script.sol";

/// @title Smoke
/// @notice Full lifecycle against a LIVE local node (anvil), in phases separated by real chain-time advances
///         (script/smoke.sh drives evm_increaseTime between phases). Proves the deployment works end to end
///         over JSON-RPC — not just inside the forge test EVM.
contract Smoke is Script {
    // anvil dev keys #0..#2 (local only)
    uint256 constant FOUNDER = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    uint256 constant BACKER_A = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    uint256 constant BACKER_B = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;

    MonetaFactory factory;
    MonetaRouter router;
    MonetaUSDC usdc;
    PermitArgs noPermit;

    function _load() internal {
        string memory json = vm.readFile(string.concat(vm.projectRoot(), "/deployments/31337.json"));
        factory = MonetaFactory(vm.parseJsonAddress(json, ".factory"));
        router = MonetaRouter(vm.parseJsonAddress(json, ".router"));
        usdc = MonetaUSDC(vm.parseJsonAddress(json, ".quote"));
    }

    function _raise() internal view returns (Raise) {
        return Raise(factory.raiseOf(factory.raiseCount()));
    }

    function phase1() external {
        _load();
        address founder = vm.addr(FOUNDER);
        uint16[] memory tranches = new uint16[](2);
        tranches[0] = 5000;
        tranches[1] = 3000;
        RaiseParams memory p;
        p.name = "Smoke Labs";
        p.symbol = "SMK";
        p.quote = address(usdc);
        p.founder = founder;
        p.price = 0.05e6;
        p.minRaise = 50e6;
        p.maxRaise = 200e6;
        p.start = uint40(block.timestamp);
        p.end = uint40(block.timestamp + 90);
        p.liquidityBps = 2000;
        p.budgetPerMonth = 10e6;
        p.trancheBps = tranches;
        p.gov = GovConfig({
            thetaTrancheBps: 0,
            thetaTeamBps: 100,
            thetaCommunityBps: 300,
            proposalLiquidityBps: 5000,
            maxStepBps: 100,
            warmup: 30,
            duration: 180,
            executionGrace: 600,
            bond: 1e6
        });

        vm.startBroadcast(FOUNDER);
        usdc.mint(founder, 1000e6);
        usdc.mint(vm.addr(BACKER_A), 1000e6);
        usdc.mint(vm.addr(BACKER_B), 1000e6);
        factory.createRaise(p, "# Smoke Labs\nEnd-to-end smoke raise.");
        vm.stopBroadcast();

        Raise r = _raise();
        _contribute(BACKER_A, r, 80e6);
        _contribute(BACKER_B, r, 60e6);
        console2.log("phase1: raise", address(r), "total", r.totalContributed());
    }

    function _contribute(uint256 key, Raise r, uint256 amount) internal {
        vm.startBroadcast(key);
        usdc.approve(address(r), amount);
        r.contribute(amount);
        vm.stopBroadcast();
    }

    function phase2() external {
        _load();
        Raise r = _raise();
        vm.broadcast(BACKER_B);
        r.finalize();
        require(r.status() == RaiseStatus.Succeeded, "raise did not succeed");
        Treasury t = Treasury(r.treasury());

        vm.broadcast(BACKER_A);
        r.claim();
        vm.broadcast(BACKER_B);
        r.claim();

        vm.startBroadcast(FOUNDER);
        usdc.approve(address(t), type(uint256).max);
        t.propose(ActionType.TrancheRelease, abi.encode(uint8(0)), "Milestone 1 shipped", noPermit);
        vm.stopBroadcast();

        vm.startBroadcast(BACKER_A);
        usdc.approve(address(router), type(uint256).max);
        router.buyOutcome(address(t), 1, true, 40e6, 0, noPermit);
        vm.stopBroadcast();
        console2.log("phase2: treasury", address(t), "proposal 1 active, PASS bought");
    }

    function phase3() external {
        _load();
        Treasury t = Treasury(_raise().treasury());
        vm.broadcast(BACKER_B);
        t.finalizeProposal(1);
        Proposal memory p = t.proposal(1);
        require(p.status == ProposalStatus.Executed, "proposal not executed");
        require(t.tranches()[0].released, "tranche not released");
        vm.broadcast(BACKER_A);
        router.redeemAll(address(t), 1);
        console2.log("phase3: Verdict PASS executed; twapPass", p.twapPass, "twapFail", p.twapFail);
        console2.log("SMOKE OK");
    }
}
