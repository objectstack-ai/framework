---
'@objectstack/cli': minor
---

feat(docker): official runtime image `ghcr.io/objectstack-ai/objectstack`

ObjectStack now ships an official, versioned Docker runtime image instead of
only a copy-me example. The image packages Node 22 + a pinned
`@objectstack/cli` + `os start` (non-root `node` user, `/api/v1/health`
HEALTHCHECK, `OS_ARTIFACT_PATH` / `OS_PORT=8080` preset), published
multi-arch (amd64/arm64) on every release with tags mirroring the CLI
version (`X.Y.Z` / `X.Y` / `X` / `latest`).

Deploying an app is now:

```dockerfile
FROM ghcr.io/objectstack-ai/objectstack:<version>
COPY --chown=node:node dist/objectstack.json /srv/app/objectstack.json
```

or, with no image build at all, `docker run` the official image with the
artifact mounted (or `OS_ARTIFACT_PATH` pointing at an `https://` URL).
`examples/docker` and the Self-Hosted Deployment docs now build on the
official image; the self-built runtime Dockerfile remains documented for
air-gapped registries.
