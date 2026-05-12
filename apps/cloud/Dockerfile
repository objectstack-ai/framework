#
# ObjectStack Cloud — production container image
# --------------------------------------------------
# Cloud-only host: multi-project control plane + Studio template registry.
# See apps/objectos/Dockerfile for the architectural notes — this is the
# same 3-stage builder → pruner → runner pipeline, scoped to @objectstack/cloud.

# ──────────────────────────────────────────────────────────────────────────
# Stage 1 — install workspace deps + build required packages
# ──────────────────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update \
  && apt-get install -y --no-install-recommends \
       python3 make g++ ca-certificates

WORKDIR /repo

# CI=true so pnpm skips interactive prompts (e.g. node_modules cleanup
# confirmation that fails with ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY).
# Route both corepack's pnpm-tarball download and pnpm's own package
# downloads through a fast public mirror — the default registry.npmjs.org
# is unreliable from many networks (CN). Override at build time with
# `--build-arg COREPACK_NPM_REGISTRY=…` if you have your own mirror.
ENV CI=true \
    COREPACK_NPM_REGISTRY=https://registry.npmmirror.com \
    npm_config_registry=https://registry.npmmirror.com

# ── Layer 0: bake pnpm into the image (one-shot network fetch) ──────────────
# Without this, every subsequent `pnpm …` invocation triggers corepack to
# re-fetch the pinned pnpm version on demand. If the mirror has a transient
# DNS or network blip, the build fails. Pinning to the version declared in
# package.json downloads it ONCE per Dockerfile change, caches the layer,
# and frees later steps from needing the corepack registry at all.
# Fall back to the official npm registry if the mirror is unreachable.
ARG PNPM_VERSION=10.31.0
RUN corepack enable \
 && (corepack prepare pnpm@${PNPM_VERSION} --activate \
     || (echo "→ npmmirror unreachable, falling back to npmjs.org" \
         && COREPACK_NPM_REGISTRY=https://registry.npmjs.org \
            corepack prepare pnpm@${PNPM_VERSION} --activate))

# ── Layer 1: pre-fetch deps from lockfile only ──────────────────────────────
# `pnpm fetch` populates the virtual store from `pnpm-lock.yaml` alone (no
# package.json files needed), so this layer is reused across builds until
# the lockfile changes. The cache mount makes the global store survive
# across `docker buildx build` invocations.
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
COPY pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
 && pnpm fetch --prod=false

# ── Layer 2: copy workspace manifests + sources, then install offline ───────
# `--offline` forces resolution from the warm store; on a code-only change
# (lockfile unchanged) this finishes in seconds.
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.json tsup.config.ts ./
COPY packages ./packages
COPY examples ./examples
COPY apps/cloud ./apps/cloud
COPY apps/studio ./apps/studio
COPY apps/account ./apps/account

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline --prod=false
# Use turbo (not raw `pnpm --filter ... build`) so its content-addressed
# cache at /repo/.turbo can short-circuit unchanged packages on rebuilds.
# Cache mounts persist the cache across `docker build` invocations.
RUN --mount=type=cache,id=turbo-cloud,target=/repo/.turbo,sharing=locked \
    --mount=type=cache,id=node-cache-cloud,target=/repo/node_modules/.cache,sharing=locked \
    pnpm exec turbo run build --filter='@objectstack/cloud...'

# ──────────────────────────────────────────────────────────────────────────
# Stage 2 — production prune (pnpm deploy)
# ──────────────────────────────────────────────────────────────────────────
FROM builder AS pruner
WORKDIR /repo
RUN pnpm --filter @objectstack/cloud deploy --prod --legacy /deploy \
  && find /deploy -type f \( -name "*.map" -o -name "*.test.*" -o -name "*.spec.*" -o -name "*.md" -o -name "*.markdown" \) -delete \
  && find /deploy -type d \( -name "__tests__" -o -name "test" -o -name "tests" -o -name "docs" -o -name "example" -o -name "examples" \) -prune -exec rm -rf {} + \
  && rm -rf /deploy/.turbo /deploy/.cache \
  # Surgical removal of dev-only deps that get pulled in by package peers
  # but are NOT used by the Cloud runtime path (verified by smoke test).
  && rm -rf \
       /deploy/node_modules/.pnpm/next@* \
       /deploy/node_modules/.pnpm/@next+* \
       /deploy/node_modules/.pnpm/playwright-core@* \
       /deploy/node_modules/.pnpm/@playwright+* \
       /deploy/node_modules/.pnpm/typescript@* \
       /deploy/node_modules/.pnpm/happy-dom@* \
       /deploy/node_modules/.pnpm/@rolldown+* \
       /deploy/node_modules/.pnpm/@img+sharp-libvips-* \
       /deploy/node_modules/.pnpm/@cloudflare+workers-types@* \
       /deploy/node_modules/.pnpm/@esbuild+* \
       /deploy/node_modules/.pnpm/lightningcss-* \
       /deploy/node_modules/.pnpm/caniuse-lite@*

# ──────────────────────────────────────────────────────────────────────────
# Stage 3 — slim runtime image
# ──────────────────────────────────────────────────────────────────────────
FROM node:22-slim AS runner

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates wget \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production \
    PORT=4000 \
    HOST=0.0.0.0 \
    OS_DISABLE_CONSOLE=1

COPY --from=pruner /deploy /app
COPY --from=builder /repo/apps/cloud/dist /app/dist

EXPOSE 4000
VOLUME ["/data"]

ENV OS_DATABASE_URL=file:/data/control.db

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT}/api/v1/health" >/dev/null 2>&1 || exit 1

CMD ["node", "node_modules/@objectstack/cli/bin/run.js", "serve", "dist/objectstack.config.js", "--prebuilt"]
