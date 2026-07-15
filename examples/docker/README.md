# Docker Reference for Standalone ObjectStack Apps

Reference container packaging for a project scaffolded with
`npm create objectstack@latest`. These files are **meant to be copied into
your app**, not built from this directory — the example apps in this repo use
`workspace:*` dependencies and are not standalone-buildable.

```bash
npm create objectstack@latest my-app
cd my-app
cp <framework>/examples/docker/{Dockerfile,docker-compose.yml,.dockerignore} .

# Image only
docker build -t my-app .

# Or the full app + Postgres stack
cat > .env <<EOF
POSTGRES_PASSWORD=$(openssl rand -hex 16)
OS_AUTH_SECRET=$(openssl rand -hex 32)
OS_SECRET_KEY=$(openssl rand -hex 32)
EOF
docker compose up -d
curl -fsS http://localhost:8080/api/v1/health
```

How it works, what the required variables mean, reverse-proxy wiring, and the
multi-node caveats are documented in
[Self-Hosted Deployment](https://docs.objectstack.ai/docs/deployment/self-hosting).

Three properties worth knowing:

- The runtime is the **official image** `ghcr.io/objectstack-ai/objectstack`
  (see [`docker/README.md`](../../docker/README.md)): Node, `@objectstack/cli`,
  non-root user, and health check — your final image adds only the compiled
  `objectstack.json`. The build stage's TypeScript toolchain never ships.
- Pin the runtime tag to the `@objectstack/cli` version in your
  `package.json` (image tags mirror CLI versions); `latest` is fine for a
  first spin, wrong for production.
- `OS_SECRET_KEY` must be provided at runtime. On a container's ephemeral
  filesystem the auto-minted dev key is lost on restart, which makes
  previously-encrypted secrets undecryptable.

Don't need an image build at all? The official runtime image can run a
mounted or remote artifact directly — see
[`docker/README.md`](../../docker/README.md).
