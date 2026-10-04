import { indexer } from "envio";
import { bumpProtocol, eventId, lower, RAISE_STATUS } from "./utils.js";

indexer.onEvent({ contract: "Raise", event: "Contributed" }, async ({ event, context }) => {
  const raiseId = lower(event.srcAddress);
  const raise = await context.Raise.getOrThrow(raiseId);
  const account = lower(event.params.contributor);
  const cid = `${raiseId}-${account}`;
  const existing = await context.Contribution.get(cid);
  const ts = BigInt(event.block.timestamp);

  context.Contribution.set({
    id: cid,
    raise_id: raiseId,
    account,
    amount: event.params.contribution,
    claimed: false,
    tokensClaimed: 0n,
    refundClaimed: 0n,
    firstAt: existing?.firstAt ?? ts,
    lastAt: ts,
  });
  context.ContributionEvent.set({
    id: eventId(event),
    raise_id: raiseId,
    account,
    amount: event.params.amount,
    totalContributed: event.params.totalContributed,
    timestamp: ts,
    txHash: event.transaction.hash,
  });
  context.Raise.set({
    ...raise,
    totalContributed: event.params.totalContributed,
    contributorCount: raise.contributorCount + (existing ? 0 : 1),
  });
});

indexer.onEvent({ contract: "Raise", event: "RaiseFinalized" }, async ({ event, context }) => {
  const raise = await context.Raise.getOrThrow(lower(event.srcAddress));
  const status = RAISE_STATUS[Number(event.params.status)] ?? "OPEN";
  context.Raise.set({
    ...raise,
    status,
    accepted: event.params.accepted,
    fee: event.params.fee,
    finalizedAt: BigInt(event.block.timestamp),
  });
  await bumpProtocol(context, event.block.timestamp, (p) =>
    status === "SUCCEEDED"
      ? { totalRaised: p.totalRaised + event.params.accepted }
      : { failedRaiseCount: p.failedRaiseCount + 1 },
  );
});

indexer.onEvent({ contract: "Raise", event: "RaiseAborted" }, async ({ event, context }) => {
  const raise = await context.Raise.getOrThrow(lower(event.srcAddress));
  context.Raise.set({ ...raise, aborted: true });
});

indexer.onEvent({ contract: "Raise", event: "Claimed" }, async ({ event, context }) => {
  const cid = `${lower(event.srcAddress)}-${lower(event.params.contributor)}`;
  const c = await context.Contribution.get(cid);
  if (!c) return;
  context.Contribution.set({
    ...c,
    claimed: true,
    tokensClaimed: event.params.tokens,
    refundClaimed: event.params.refund,
  });
});
