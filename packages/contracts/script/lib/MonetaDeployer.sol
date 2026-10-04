// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ConditionalToken} from "../../src/ConditionalToken.sol";
import {ConditionalVault} from "../../src/ConditionalVault.sol";
import {MonetaAMM} from "../../src/MonetaAMM.sol";
import {MonetaFactory} from "../../src/MonetaFactory.sol";
import {MonetaRouter} from "../../src/MonetaRouter.sol";
import {ProjectToken} from "../../src/ProjectToken.sol";
import {Raise} from "../../src/Raise.sol";
import {Treasury} from "../../src/Treasury.sol";
import {Bounds} from "../../src/types/MonetaTypes.sol";

/// @title MonetaDeployer
/// @notice The single source of truth for deployment order and wiring — used by deploy scripts AND the test suite,
///         so tests always exercise exactly what ships. Order follows the real dependency graph:
///         AMM → ConditionalToken impl → Vault → impls → Factory → Router → vault.initialize(amm, router)
///         → allowlist quote. Ownership handoff to the Safe is a separate script step.
library MonetaDeployer {
    struct Config {
        address owner; // initial owner of Factory + AMM (the deployer; handed to the Safe afterwards)
        address feeRecipient;
        uint16 raiseFeeBps;
        uint16 poolFeeBps;
        uint16 protocolFeeShareBps;
        Bounds bounds;
        address quote; // allowlisted quote asset (USDC); zero to skip
    }

    struct Deployment {
        MonetaAMM amm;
        ConditionalVault vault;
        MonetaFactory factory;
        MonetaRouter router;
        address conditionalTokenImpl;
        address projectTokenImpl;
        address treasuryImpl;
        address raiseImpl;
    }

    function deploy(Config memory c) internal returns (Deployment memory d) {
        d.amm = new MonetaAMM(c.owner, c.feeRecipient, c.protocolFeeShareBps);
        d.conditionalTokenImpl = address(new ConditionalToken());
        d.vault = new ConditionalVault(d.conditionalTokenImpl);
        d.projectTokenImpl = address(new ProjectToken());
        d.treasuryImpl = address(new Treasury());
        d.raiseImpl = address(new Raise());
        d.factory = new MonetaFactory(
            MonetaFactory.ConstructorArgs({
                owner: c.owner,
                vault: address(d.vault),
                amm: address(d.amm),
                raiseImplementation: d.raiseImpl,
                treasuryImplementation: d.treasuryImpl,
                tokenImplementation: d.projectTokenImpl,
                feeRecipient: c.feeRecipient,
                raiseFeeBps: c.raiseFeeBps,
                poolFeeBps: c.poolFeeBps,
                bounds: c.bounds
            })
        );
        d.router = new MonetaRouter(d.factory, d.vault, d.amm);
        d.vault.initialize(address(d.amm), address(d.router));
        if (c.quote != address(0)) d.factory.setQuoteAllowed(c.quote, true);
    }
}
