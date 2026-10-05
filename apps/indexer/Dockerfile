# Self-hosted Moneta indexer (Envio HyperIndex, `envio start`) — the fallback to Envio Cloud.
# Postgres + Hasura come from docker-compose.yml. Build from the repo root:
#   docker build -f apps/indexer/Dockerfile -t moneta-indexer .
FROM node:24-bookworm-slim
# Envio's native RPC/HyperSync clients verify TLS against the system CA store, which the slim image lacks.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
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
RUN pnpm install --frozen-lockfile --filter "@moneta/indexer..."
COPY packages/config packages/config
COPY packages/sdk packages/sdk
COPY packages/contracts/deployments packages/contracts/deployments
COPY apps/indexer apps/indexer
WORKDIR /repo/apps/indexer
# INDEXER_NETWORK=testnet (HyperSync with ENVIO_API_TOKEN, else the Monad RPC) or local (LOCAL_RPC_URL)
ENV INDEXER_NETWORK=testnet
RUN chown -R node:node /repo/apps/indexer
USER node
CMD ["sh", "-c", "./node_modules/.bin/tsx scripts/gen-config.ts $INDEXER_NETWORK && ./node_modules/.bin/envio codegen && ./node_modules/.bin/envio start"]
