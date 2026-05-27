# Licensing

ObjectStack is dual-licensed. Each package in this monorepo is released under
one of two licenses, listed below. See each package's own `LICENSE` file and
its `package.json` `license` field for the authoritative answer.

## Quick rule

- **Protocols, SDKs, CLI, adapters → Apache License 2.0**
- **Runtime, services, official plugins, drivers → Business Source License 1.1**
  (automatically converts to Apache 2.0 four years after each release)

The full text of each license lives at the repository root:

- [`LICENSE.apache`](./LICENSE.apache) — Apache License, Version 2.0
- [`LICENSE.bsl`](./LICENSE.bsl) — Business Source License 1.1

## Apache 2.0 packages

These are the integration surface. Anyone — open source projects, commercial
products, SaaS, plugin authors — can use, modify, and redistribute them with
no strings attached, including for any commercial purpose.

- `packages/spec`
- `packages/types`
- `packages/client`
- `packages/client-react`
- `packages/cli`
- `packages/create-objectstack`
- `packages/vscode-objectstack`
- `packages/adapters/*` (express, fastify, hono, nestjs, nextjs, nuxt, sveltekit)
- `packages/formula`
- `packages/observability`
- `packages/platform-objects`

## BSL 1.1 packages

These are the runtime and managed-platform substrate. They are free to use for
almost any purpose, with one carve-out: you may not offer them as a hosted
service that competes with ObjectStack Cloud.

- `packages/core`
- `packages/runtime`
- `packages/rest`
- `packages/metadata`
- `packages/metadata-core`
- `packages/metadata-fs`
- `packages/objectql`
- `packages/services/*` (all platform services)
- `packages/plugins/*` (all official plugins and drivers)

Each release of a BSL-licensed package automatically converts to Apache 2.0
four years after that release is first published.

## What you can do under BSL

- Run ObjectStack on your own servers, on-premise or in any cloud, for any
  internal business purpose, with unlimited users.
- Deliver ObjectStack to customers as part of a consulting or systems
  integration engagement, including private deployments dedicated to a single
  customer.
- Build a SaaS product **on top of** ObjectStack (using it as the backend for
  your own application) and sell that product to your customers. Your SaaS is
  not "ObjectStack as a service" — it is your product, which happens to use
  ObjectStack internally.
- Modify the source code, build derivative works, redistribute, and contribute
  back upstream.
- Use the software for education, research, evaluation, and non-production
  workloads of any kind.

## What you cannot do under BSL

- Offer a hosted or managed service that gives third parties access to
  ObjectStack itself as the product (a "competing offering"). If this is what
  you want to do, contact `licensing@objectstack.dev` for a commercial
  license, or wait for the four-year Change Date when that version becomes
  Apache 2.0.

The precise wording of the carve-out is in [`LICENSE.bsl`](./LICENSE.bsl)
under "Additional Use Grant". The BSL text is authoritative.

## Plugins and the application marketplace

Third-party plugins authored against ObjectStack's public protocol surface
(`@objectstack/spec` and the Apache-licensed SDKs) are not derivative works of
the BSL-licensed runtime. Plugin authors are free to choose any license they
want — open source, proprietary, or commercial — for their own code.

The marketplace itself is governed by a separate Terms of Service, not by
this file.

## Contributions

Contributions to this repository are accepted under the same license as the
package being modified (Apache 2.0 for Apache-licensed packages, BSL 1.1 for
BSL-licensed packages). By submitting a contribution you agree that it may be
relicensed by ObjectStack AI LLC if the project as a whole is
relicensed in the future.

## Commercial licensing

For commercial licenses, OEM agreements, or any usage that does not fit the
terms above, contact `licensing@objectstack.dev`.
