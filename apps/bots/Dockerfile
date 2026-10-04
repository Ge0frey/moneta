# Moneta bots: keeper · market makers · watcher. Build from the repo root:
#   docker build -f apps/bots/Dockerfile -t moneta-bots .
#   docker run --env-file .env moneta-bots keeper --network testnet
# Keys come from the platform's secret store (KEEPER_KEY, TRADER_MNEMONIC) — never baked into the image.
FROM node:24-bookworm-slim AS deps
ENV CI=1
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config/package.json packages/config/
COPY packages/sdk/package.json packages/sdk/
COPY packages/contracts/package.json packages/contracts/
COPY apps/bots/package.json apps/bots/
COPY apps/web/package.json apps/web/
COPY apps/indexer/package.json apps/indexer/
RUN pnpm install --frozen-lockfile --filter "@moneta/bots..." --ignore-scripts

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=deps /repo /repo
COPY packages/config packages/config
COPY packages/sdk packages/sdk
COPY packages/contracts/deployments packages/contracts/deployments
COPY apps/bots apps/bots
USER node
WORKDIR /repo/apps/bots
ENTRYPOINT ["./node_modules/.bin/tsx", "src/index.ts"]
CMD ["all", "--network", "testnet"]
