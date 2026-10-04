# Runbook: incident response

Moneta is immutable and the protocol Safe cannot move funds or pause trading (ADR 0003). The response to a suspected exploit is containment and communication, never intervention in live markets.

## Severity

| Level | Examples | First response |
|---|---|---|
| **Critical** | Watcher reports a solvency invariant broken (vault collateral < conditional supply; AMM balance < reserves; router holding funds); an unexpected transfer out of a Treasury/Raise/AMM | Page the team immediately |
| **High** | A keeper outage leaving proposals or raises unfinalized well past their end; indexer > 200 blocks behind | Within the hour |
| **Warning** | Low bot MON (< 15), gas above budget, indexer > 20 blocks behind | Next working session |

## Critical playbook

1. **Contain new exposure.** From the Safe, call `MonetaFactory.setCreationPaused(true)`. This stops *new* raises only. Existing raises, refunds, claims, markets and redemptions keep working by design.
2. **Communicate.** Post on every channel (app banner via `/status`, X, Discord) what is affected and that exits remain open.
3. **Diagnose.** Pull the watcher alert, the tx hash, and a trace (`cast run <tx> --rpc-url …`). Reproduce on a fork: `forge test --fork-url … --match-test …`.
4. **Fix forward.** Ship a fixed factory version (new deployment), keep the old one paused, and point the web app and indexer at both.
5. **Postmortem** within 7 days in `docs/postmortems/`.

## Keeper outage

Every protocol action is permissionless:
- Anyone can finalize a raise or proposal from the app (**Finalize** buttons appear after the end).
- Restart the bots, then check `/status` → Keeper.

## Key compromise

- **Bot key:** rotate in the platform secret store and drain the old EOA. Bots hold only gas and small amounts of testnet USDC.
- **Safe signer:** rotate the signer through the Safe. Admin powers are bounded and can't reach funds.
