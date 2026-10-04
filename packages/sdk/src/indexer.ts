/**
 * Typed client for the Envio/Hasura GraphQL API. DERIVED data only (lists, history, charts, portfolio) —
 * gates, amounts and verdicts must come from chain reads (reads.ts).
 * Numbers arrive as decimal strings (BigInt columns); helpers below convert to bigint.
 */

export type GqlBig = string;

export type IndexedProtocol = {
  raiseCount: number;
  projectCount: number;
  failedRaiseCount: number;
  totalRaised: GqlBig;
  proposalCount: number;
  verdictsPassed: number;
  verdictsFailed: number;
  redeemedCount: number;
  volumeQuote: GqlBig;
};

export type IndexedRaise = {
  id: string;
  raiseId: GqlBig;
  address: string;
  founder_id: string;
  name: string;
  symbol: string;
  quote: string;
  price: GqlBig;
  minRaise: GqlBig;
  maxRaise: GqlBig;
  start: GqlBig;
  end: GqlBig;
  liquidityBps: number;
  budgetPerMonth: GqlBig;
  trancheBps: number[];
  status: "OPEN" | "FAILED" | "SUCCEEDED";
  aborted: boolean;
  totalContributed: GqlBig;
  contributorCount: number;
  accepted: GqlBig;
  memo: string;
  memoHash: string;
  token: string | null;
  treasury: string | null;
  createdAt: GqlBig;
  thetaTrancheBps: number;
  thetaTeamBps: number;
  thetaCommunityBps: number;
  warmup: GqlBig;
  duration: GqlBig;
  bond: GqlBig;
};

export type IndexedProject = {
  id: string;
  projectId: GqlBig;
  name: string;
  symbol: string;
  token: string;
  treasury: string;
  founder: string;
  state: "ACTIVE" | "REDEEMED";
  launchedAt: GqlBig;
  totalSupply: GqlBig;
  holderCount: number;
  proposalCount: number;
  lastPrice: GqlBig;
  volumeQuote: GqlBig;
  releasedQuote: GqlBig;
  treasuryQuoteAtLaunch: GqlBig;
  raise_id: string;
  activeProposal_id: string | null;
  spotPool_id: string | null;
};

export type IndexedProposal = {
  id: string;
  project_id: string;
  proposalId: GqlBig;
  proposer: string;
  isTeam: boolean;
  actionType: number;
  actionData: `0x${string}`;
  memo: string;
  memoHash: string;
  thetaBps: number;
  bond: GqlBig;
  status: "QUEUED" | "ACTIVE" | "PASSED" | "FAILED" | "EXECUTED" | "CANCELLED";
  executionFailed: boolean;
  conditionId: string | null;
  passPool_id: string | null;
  failPool_id: string | null;
  tradingStart: GqlBig | null;
  tradingEnd: GqlBig | null;
  twapPass: GqlBig | null;
  twapFail: GqlBig | null;
  passed: boolean | null;
  createdAt: GqlBig;
  finalizedAt: GqlBig | null;
  volumeQuote: GqlBig;
  tradeCount: number;
};

export type IndexedPricePoint = {
  kind: "SPOT" | "OBSERVATION";
  timestamp: GqlBig;
  price: GqlBig;
  observation: GqlBig;
  cumulative: GqlBig;
};

export type IndexedTrade = {
  id: string;
  trader: string;
  side: "PASS" | "FAIL";
  isBuy: boolean;
  amountIn: GqlBig;
  amountOut: GqlBig;
  timestamp: GqlBig;
  txHash: string;
};

export type IndexedFlow = {
  id: string;
  kind: string;
  amount: GqlBig;
  account: string | null;
  token: string | null;
  proposalId: GqlBig | null;
  timestamp: GqlBig;
  txHash: string;
};

export type IndexedContribution = {
  raise_id: string;
  account: string;
  amount: GqlBig;
  claimed: boolean;
  tokensClaimed: GqlBig;
  refundClaimed: GqlBig;
  lastAt: GqlBig;
};

export type IndexedPosition = {
  account: string;
  token: string;
  conditionId: string;
  collateral: string;
  side: "PASS" | "FAIL";
  balance: GqlBig;
};

export type IndexerMeta = { chainId: number; progressBlock: number; isReady: boolean };

const RAISE_FIELDS = `id raiseId address founder_id name symbol quote price minRaise maxRaise start end liquidityBps
  budgetPerMonth trancheBps status aborted totalContributed contributorCount accepted memo memoHash token treasury
  createdAt thetaTrancheBps thetaTeamBps thetaCommunityBps warmup duration bond`;
const PROJECT_FIELDS = `id projectId name symbol token treasury founder state launchedAt totalSupply holderCount
  proposalCount lastPrice volumeQuote releasedQuote treasuryQuoteAtLaunch raise_id activeProposal_id spotPool_id`;
const PROPOSAL_FIELDS = `id project_id proposalId proposer isTeam actionType actionData memo memoHash thetaBps bond
  status executionFailed conditionId passPool_id failPool_id tradingStart tradingEnd twapPass twapFail passed
  createdAt finalizedAt volumeQuote tradeCount`;

export class IndexerClient {
  constructor(
    readonly url: string,
    // Wrapped so `fetch` is never invoked with the client as `this` (browsers throw "Illegal invocation").
    private readonly fetchImpl: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  async query<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const res = await this.fetchImpl(this.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`Indexer HTTP ${res.status}`);
    const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (json.errors?.length) throw new Error(`Indexer: ${json.errors[0]!.message}`);
    return json.data as T;
  }

  async meta(): Promise<IndexerMeta | undefined> {
    const d = await this.query<{ _meta: IndexerMeta[] }>(
      `{ _meta { chainId progressBlock isReady } }`,
    );
    return d._meta[0];
  }

  /** Resolve once the indexer has processed `block` or the timeout elapses. */
  async waitForBlock(block: bigint | number, timeoutMs = 10_000, pollMs = 400): Promise<boolean> {
    const target = Number(block);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const m = await this.meta();
        if (m && m.progressBlock >= target) return true;
      } catch {
        /* keep polling */
      }
      await new Promise((r) => setTimeout(r, pollMs));
    }
    return false;
  }

  async protocol(): Promise<IndexedProtocol | undefined> {
    const d = await this.query<{ Protocol: IndexedProtocol[] }>(
      `{ Protocol(where: {id: {_eq: "moneta"}}) { raiseCount projectCount failedRaiseCount totalRaised proposalCount
        verdictsPassed verdictsFailed redeemedCount volumeQuote } }`,
    );
    return d.Protocol[0];
  }

  async raises(opts: { status?: IndexedRaise["status"]; founder?: string; limit?: number } = {}) {
    const where: string[] = [];
    if (opts.status) where.push(`status: {_eq: "${opts.status}"}`);
    if (opts.founder) where.push(`founder_id: {_eq: "${opts.founder.toLowerCase()}"}`);
    const d = await this.query<{ Raise: IndexedRaise[] }>(
      `{ Raise(where: {${where.join(", ")}}, order_by: {createdAt: desc}, limit: ${opts.limit ?? 100}) { ${RAISE_FIELDS} } }`,
    );
    return d.Raise;
  }

  async raise(address: string) {
    const d = await this.query<{
      Raise_by_pk:
        | (IndexedRaise & {
            contributionEvents: {
              account: string;
              amount: GqlBig;
              totalContributed: GqlBig;
              timestamp: GqlBig;
              txHash: string;
            }[];
          })
        | null;
    }>(
      `query($id: String!) { Raise_by_pk(id: $id) { ${RAISE_FIELDS}
        contributionEvents(order_by: {timestamp: asc}) { account amount totalContributed timestamp txHash } } }`,
      { id: address.toLowerCase() },
    );
    return d.Raise_by_pk;
  }

  async founderHistory(founder: string) {
    const d = await this.query<{
      Founder_by_pk: { raiseCount: number; launchedCount: number; redeemedCount: number } | null;
    }>(
      `query($id: String!) { Founder_by_pk(id: $id) { raiseCount launchedCount redeemedCount } }`,
      {
        id: founder.toLowerCase(),
      },
    );
    return d.Founder_by_pk;
  }

  async projects(limit = 100) {
    const d = await this.query<{ Project: IndexedProject[] }>(
      `{ Project(order_by: {launchedAt: desc}, limit: ${limit}) { ${PROJECT_FIELDS} } }`,
    );
    return d.Project;
  }

  async project(treasury: string) {
    const d = await this.query<{
      Project_by_pk: (IndexedProject & { flows: IndexedFlow[] }) | null;
    }>(
      `query($id: String!) { Project_by_pk(id: $id) { ${PROJECT_FIELDS}
        flows(order_by: {timestamp: desc}, limit: 100) { id kind amount account token proposalId timestamp txHash } } }`,
      { id: treasury.toLowerCase() },
    );
    return d.Project_by_pk;
  }

  async proposals(treasury: string) {
    const d = await this.query<{ Proposal: IndexedProposal[] }>(
      `query($p: String!) { Proposal(where: {project_id: {_eq: $p}}, order_by: {proposalId: desc}) { ${PROPOSAL_FIELDS} } }`,
      { p: treasury.toLowerCase() },
    );
    return d.Proposal;
  }

  async activeProposals(limit = 20) {
    const d = await this.query<{
      Proposal: (IndexedProposal & {
        project: { name: string; symbol: string; treasury: string };
      })[];
    }>(
      `{ Proposal(where: {status: {_eq: "ACTIVE"}}, order_by: {createdAt: desc}, limit: ${limit}) { ${PROPOSAL_FIELDS}
        project { name symbol treasury } } }`,
    );
    return d.Proposal;
  }

  async proposal(treasury: string, id: bigint | number) {
    const d = await this.query<{
      Proposal_by_pk: (IndexedProposal & { trades: IndexedTrade[] }) | null;
    }>(
      `query($id: String!) { Proposal_by_pk(id: $id) { ${PROPOSAL_FIELDS}
        trades(order_by: {timestamp: desc}, limit: 50) { id trader side isBuy amountIn amountOut timestamp txHash } } }`,
      { id: `${treasury.toLowerCase()}-${id.toString()}` },
    );
    return d.Proposal_by_pk;
  }

  /** Price series for charts (spot after swaps + lagging observation updates), oldest first. */
  async pricePoints(poolId: bigint | string, sinceTs = 0) {
    const d = await this.query<{ PricePoint: IndexedPricePoint[] }>(
      `query($p: String!, $t: numeric!) { PricePoint(where: {pool_id: {_eq: $p}, timestamp: {_gte: $t}},
        order_by: [{timestamp: asc}, {id: asc}], limit: 5000) { kind timestamp price observation cumulative } }`,
      { p: poolId.toString(), t: sinceTs },
    );
    return d.PricePoint;
  }

  async portfolio(account: string) {
    const a = account.toLowerCase();
    const d = await this.query<{
      Contribution: (IndexedContribution & {
        raise: { name: string; symbol: string; status: string; treasury: string | null };
      })[];
      Position: IndexedPosition[];
      Holder: {
        balance: GqlBig;
        project: {
          name: string;
          symbol: string;
          treasury: string;
          token: string;
          state: string;
          lastPrice: GqlBig;
        };
      }[];
    }>(
      `query($a: String!) {
        Contribution(where: {account: {_eq: $a}}, order_by: {lastAt: desc}) { raise_id account amount claimed tokensClaimed
          refundClaimed lastAt raise { name symbol status treasury } }
        Position(where: {account: {_eq: $a}, balance: {_gt: "0"}}) { account token conditionId collateral side balance }
        Holder(where: {account: {_eq: $a}, balance: {_gt: "0"}}) { balance project { name symbol treasury token state lastPrice } }
      }`,
      { a },
    );
    return d;
  }

  async proposalsByCondition(conditionIds: string[]) {
    if (conditionIds.length === 0) return [];
    const d = await this.query<{
      Proposal: (IndexedProposal & {
        project: { name: string; symbol: string; treasury: string };
      })[];
    }>(
      `query($c: [String!]) { Proposal(where: {conditionId: {_in: $c}}) { ${PROPOSAL_FIELDS} project { name symbol treasury } } }`,
      { c: conditionIds },
    );
    return d.Proposal;
  }
}

export const big = (v: GqlBig | null | undefined): bigint =>
  v === null || v === undefined ? 0n : BigInt(v);
