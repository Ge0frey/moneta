import { indexer } from "envio";
import { eventId, lower, proposalKey, ZERO } from "./utils.js";

// ── Conditional tokens: register clones as they are created; positions from transfers ────────────

indexer.contractRegister(
  { contract: "ConditionalVault", event: "ConditionalTokensCreated" },
  async ({ event, context }) => {
    context.chain.ConditionalToken.add(event.params.passToken);
    context.chain.ConditionalToken.add(event.params.failToken);
  },
);

indexer.onEvent(
  { contract: "ConditionalVault", event: "ConditionalTokensCreated" },
  async ({ event, context }) => {
    const base = {
      conditionId: event.params.conditionId,
      collateral: lower(event.params.collateral),
    };
    context.ConditionalTokenMeta.set({ id: lower(event.params.passToken), ...base, side: "PASS" });
    context.ConditionalTokenMeta.set({ id: lower(event.params.failToken), ...base, side: "FAIL" });
  },
);

indexer.onEvent({ contract: "ConditionalVault", event: "Resolved" }, async () => {
  // Verdicts are recorded from Treasury.ProposalFinalized (which carries the TWAPs).
});

indexer.onEvent({ contract: "ConditionalToken", event: "Transfer" }, async ({ event, context }) => {
  const token = lower(event.srcAddress);
  const meta = await context.ConditionalTokenMeta.get(token);
  if (!meta) return;
  const move = async (account: string, delta: bigint) => {
    if (account === ZERO) return;
    const id = `${account}-${token}`;
    const pos = await context.Position.get(id);
    context.Position.set({
      id,
      account,
      token,
      conditionId: meta.conditionId,
      collateral: meta.collateral,
      side: meta.side,
      balance: (pos?.balance ?? 0n) + delta,
    });
  };
  await move(lower(event.params.from), -event.params.value);
  await move(lower(event.params.to), event.params.value);
});

// ── Project tokens: holders and supply ──────────────────────────────────────────────────────────

/** Protocol contracts (AMM, vault, router) for this chain, from the generated config. */
function protocolAddresses(chainId: number): Set<string> {
  const chain = indexer.chains[chainId as keyof typeof indexer.chains] as unknown as Record<
    string,
    { addresses?: readonly string[] }
  >;
  const out = new Set<string>();
  for (const name of ["MonetaAMM", "ConditionalVault", "MonetaRouter"]) {
    for (const a of chain?.[name]?.addresses ?? []) out.add(lower(a));
  }
  return out;
}

indexer.onEvent({ contract: "ProjectToken", event: "Transfer" }, async ({ event, context }) => {
  const token = lower(event.srcAddress);
  const link = await context.TokenLink.get(token);
  if (!link) return;
  const project = await context.Project.getOrThrow(link.project_id);
  const from = lower(event.params.from);
  const to = lower(event.params.to);
  const value = event.params.value;
  const excluded = protocolAddresses(event.chainId);
  excluded.add(project.treasury);
  excluded.add(project.raise_id);
  let holderDelta = 0;

  const move = async (account: string, delta: bigint) => {
    if (account === ZERO) return;
    const id = `${link.project_id}-${account}`;
    const h = await context.Holder.get(id);
    const before = h?.balance ?? 0n;
    const after = before + delta;
    const isProtocol = excluded.has(account);
    if (!isProtocol && before === 0n && after > 0n) holderDelta += 1;
    if (!isProtocol && before > 0n && after === 0n) holderDelta -= 1;
    context.Holder.set({ id, project_id: link.project_id, account, balance: after, isProtocol });
  };
  await move(from, -value);
  await move(to, value);

  let totalSupply = project.totalSupply;
  if (from === ZERO) totalSupply += value;
  if (to === ZERO) totalSupply -= value;
  context.Project.set({ ...project, totalSupply, holderCount: project.holderCount + holderDelta });
});

// ── Router: per-proposal trade feed ─────────────────────────────────────────────────────────────

indexer.onEvent(
  { contract: "MonetaRouter", event: "OutcomeTraded" },
  async ({ event, context }) => {
    const key = proposalKey(event.params.treasury, event.params.proposalId);
    const proposal = await context.Proposal.get(key);
    if (!proposal) return;
    context.OutcomeTrade.set({
      id: eventId(event),
      proposal_id: key,
      trader: lower(event.params.trader),
      side: event.params.pass ? "PASS" : "FAIL",
      isBuy: event.params.buy,
      amountIn: event.params.amountIn,
      amountOut: event.params.amountOut,
      timestamp: BigInt(event.block.timestamp),
      txHash: event.transaction.hash,
    });
    context.Proposal.set({ ...proposal, tradeCount: proposal.tradeCount + 1 });
  },
);
