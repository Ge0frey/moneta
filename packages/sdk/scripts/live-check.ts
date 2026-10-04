/** Live sanity check of the SDK readers against a running chain (default: local anvil after deploy + smoke). */
import { createPublicClient, http } from "viem";
import {
  localAnvil,
  getDeployment,
  readFactory,
  readRaise,
  readProject,
  readProposal,
  formatUsd,
  formatScaledPrice,
  formatTokenPrice,
  actionTitle,
  PROPOSAL_STATUS_LABEL,
} from "../src/index";
const client = createPublicClient({ chain: localAnvil, transport: http() });
const d = getDeployment(31337);
const f = await readFactory(client, d);
console.log(
  "factory: raises",
  f.raiseCount,
  "fee",
  f.raiseFeeBps,
  "bounds.minDuration",
  f.bounds.minDuration,
);
const raiseAddr = await client.readContract({
  address: d.factory,
  abi: (await import("../src/index.js")).monetaFactoryAbi,
  functionName: "raiseOf",
  args: [1n],
});
const r = await readRaise(client, raiseAddr, "0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
console.log(
  "raise: status",
  r.status,
  "total",
  formatUsd(r.totalContributed),
  "price",
  formatTokenPrice(r.price),
  "account contribution",
  formatUsd(r.account!.contribution),
  "claimed",
  r.account!.claimed,
);
const p = await readProject(client, d, r.treasury);
console.log(
  "project:",
  p.tokenMeta.symbol,
  "spot",
  formatScaledPrice((p.spot.reserveQuote * 10n ** 36n) / p.spot.reserveBase),
  "treasury",
  formatUsd(p.availableQuote),
  "nav/token",
  formatTokenPrice(p.nav.navPerToken),
  "tranches",
  p.tranches.map((t) => t.released),
);
const pv = await readProposal(client, d, p, 1n);
console.log(
  "proposal 1:",
  actionTitle(pv.action),
  PROPOSAL_STATUS_LABEL[pv.proposal.status as 5],
  "projection passing",
  pv.projection?.passing,
  "premium bps",
  pv.projection?.premiumBps,
);
