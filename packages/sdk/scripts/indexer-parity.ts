/**
 * Indexer ⇄ chain parity: every indexed raise, project and proposal must match chain view results
 * field by field. Exits non-zero on any mismatch. Usage: pnpm --filter @moneta/sdk parity [local|testnet]
 */
import {
  big,
  getDeployment,
  IndexerClient,
  localAnvil,
  monadTestnet,
  ProposalStatus,
  readProject,
  readProposal,
  readRaise,
} from "../src/index";
import { createPublicClient, http, type Address } from "viem";

const network = process.argv[2] ?? "local";
const chain = network === "testnet" ? monadTestnet : localAnvil;
const rpc = network === "testnet" ? process.env.MONAD_TESTNET_RPC_URL : process.env.LOCAL_RPC_URL;
const client = createPublicClient({ chain, transport: http(rpc) });
const d = getDeployment(chain.id);
const idx = new IndexerClient(process.env.INDEXER_URL ?? "http://localhost:8080/v1/graphql");

const RAISE_STATUS = ["OPEN", "FAILED", "SUCCEEDED"];
const PROPOSAL_STATUS: Record<number, string> = {
  [ProposalStatus.Queued]: "QUEUED",
  [ProposalStatus.Active]: "ACTIVE",
  [ProposalStatus.Passed]: "PASSED",
  [ProposalStatus.Failed]: "FAILED",
  [ProposalStatus.Executed]: "EXECUTED",
  [ProposalStatus.Cancelled]: "CANCELLED",
};

let checks = 0;
const failures: string[] = [];
function eq(label: string, indexed: unknown, onchain: unknown) {
  checks++;
  if (String(indexed) !== String(onchain))
    failures.push(`${label}: indexer=${indexed} chain=${onchain}`);
}

// Wait for the indexer to reach the current head (Monad makes a block every ~300 ms, so it is rarely exactly there).
const head = await client.getBlockNumber();
const caughtUp = await idx.waitForBlock(head, 60_000);
const meta = await idx.meta();
if (!caughtUp || !meta) {
  console.error(`indexer not caught up (progress ${meta?.progressBlock} vs head ${head})`);
  process.exit(1);
}

for (const r of await idx.raises({ limit: 1000 })) {
  const c = await readRaise(client, r.address as Address);
  eq(`raise ${r.symbol} status`, r.status, RAISE_STATUS[c.status]);
  eq(`raise ${r.symbol} total`, r.totalContributed, c.totalContributed);
  eq(`raise ${r.symbol} contributors`, r.contributorCount, c.contributorCount);
  eq(`raise ${r.symbol} accepted`, r.accepted, c.accepted);
  eq(`raise ${r.symbol} price`, r.price, c.price);
}

for (const p of await idx.projects(1000)) {
  const c = await readProject(client, d, p.treasury as Address);
  eq(`project ${p.symbol} supply`, p.totalSupply, c.tokenMeta.totalSupply);
  eq(`project ${p.symbol} proposals`, p.proposalCount, c.proposalCount);
  eq(`project ${p.symbol} state`, p.state, c.state === 0 ? "ACTIVE" : "REDEEMED");
  eq(
    `project ${p.symbol} price`,
    p.lastPrice,
    c.spot.reserveBase === 0n
      ? p.lastPrice
      : (c.spot.reserveQuote * 10n ** 36n) / c.spot.reserveBase,
  );
  for (const ip of await idx.proposals(p.treasury)) {
    const v = await readProposal(client, d, c, big(ip.proposalId));
    const label = `proposal ${p.symbol}#${ip.proposalId}`;
    eq(`${label} status`, ip.status, PROPOSAL_STATUS[v.proposal.status]);
    if (ip.twapPass) eq(`${label} twapPass`, ip.twapPass, v.proposal.twapPass);
    if (ip.twapFail) eq(`${label} twapFail`, ip.twapFail, v.proposal.twapFail);
    eq(`${label} memoHash`, ip.memoHash, v.proposal.memoHash);
  }
}

if (failures.length) {
  console.error(`✗ parity: ${failures.length}/${checks} mismatches\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`✓ parity: ${checks} checks, indexer matches chain (block ${meta.progressBlock})`);
