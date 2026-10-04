/**
 * @moneta/sdk — the single bridge between the contracts and every TypeScript consumer (web, bots, tests).
 *  - generated ABIs + address book
 *  - exact protocol math (CPMath, LaggingOracle) mirrored bit-for-bit and parity-tested against forge vectors
 *  - proposal action codec, error decoding, permit signing
 *  - chain-authoritative readers and the transaction pipeline (Monad gas policy)
 */
export * from "./constants";
export * from "./chains";
export * from "./addresses";
export * from "./types";
export * from "./actions";
export * from "./errors";
export * from "./permit";
export * from "./reads";
export * from "./tx";
export * from "./format";
export * from "./math/cpmath";
export * from "./math/oracle";
export * from "./math/units";
export * from "./generated/abis";
export { deployments } from "./generated/deployments";
export * from "./indexer";
