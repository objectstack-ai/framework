# @objectstack/plugin-node-server

A **thin, zero-dependency `node:http` adapter** implementing the ObjectStack
transport port (`IHttpServer` from `@objectstack/spec/contracts`).

## Why this exists

The transport layer was designed ports-and-adapters style (ADR-0076 D11), but
only the Hono adapter ever existed — so "the port is framework-agnostic" was
an unproven claim (ADR-0076 OQ#10, issue #2462). This package is the proof:

- `NodeHttpServer` implements the `IHttpServer` contract (plus the two
  documented soft extensions consumers feature-detect: SSE streaming via
  `res.write`/`res.end`, and `getPort()`) on raw `node:http`, with **no**
  framework and **no** third-party dependencies.
- `src/conformance.integration.test.ts` boots the framework's real route
  consumers — the dispatcher bridge (`createDispatcherPlugin`) and the REST
  route generator (`createRestApiPlugin` + ObjectQL) — on **both** adapters
  and asserts identical observable behavior over real sockets, including a
  full `/data` CRUD roundtrip, `:param` routing, 404/405 semantics, and
  discovery.

If a Hono-ism ever leaks into a route consumer, the node half of that suite
is what breaks.

## What it deliberately does NOT implement

Each of these is a known escape hatch outside the port; consumers
feature-detect and degrade gracefully when they are absent:

- `getRawApp()` — Hono-specific. Metadata HMR routes, cloud-connection /
  marketplace routes, and the hono-plugin's static/SPA + CORS + Server-Timing
  layers use it and will log-and-skip on this adapter.
- `mount()` — Hono sub-app composition.
- Multipart form parsing — binary/multipart bodies stay raw and are reachable
  via the lazy `req.rawBody()` accessor.

Production deployments should keep using `@objectstack/plugin-hono-server`.
This adapter targets the conformance suite and minimal embedding scenarios.

## Usage

```ts
import { LiteKernel } from '@objectstack/core';
import { NodeServerPlugin } from '@objectstack/plugin-node-server';
import { createDispatcherPlugin, createRestApiPlugin } from '@objectstack/runtime';

const kernel = new LiteKernel();
kernel.use(new NodeServerPlugin({ port: 3000 }));
kernel.use(createRestApiPlugin());
kernel.use(createDispatcherPlugin({ prefix: '/api/v1' }));
await kernel.bootstrap();
```
