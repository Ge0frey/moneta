# ADR 0002: The Treasury is both custodian and futarchy engine

- **Status:** Accepted
- **Decision:**
  - One per-project `Treasury` holds the funds and runs the proposal lifecycle: propose, activate, finalize, execute.
  - It is the resolver of its own vault conditions and the owner of its pools.
  - Privileged actions happen only through `executeAction` (`onlySelf`), reached from a PASSED proposal.
- **Why:** A separate governor would add a governor↔timelock authority boundary with no security gain.
- **Consequences:** One contract per project to audit. Custody is isolated per project.
