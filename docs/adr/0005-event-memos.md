# ADR 0005: Memos live in event data with on-chain hashes

- **Status:** Accepted
- **Decision:**
  - Raise Memos and proposal memos are emitted in full in `RaiseCreated` / `ProposalCreated`.
  - Their `keccak256` hash is stored on-chain.
  - The indexer serves the text, and clients verify it against the hash.
- **Why:** No storage-provider dependency, and the text is immutable and verifiable. Calldata is cheap on Monad.
