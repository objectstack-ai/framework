# Licensing

ObjectStack uses folder-scoped dual licensing. The license for a file is
determined by the folder rule below. Published package manifests mirror these
rules through their `package.json` `license` fields.

## Quick rule

- **Everything is Apache License 2.0 by default**
- **Only `packages/services/*/` and `packages/plugins/*/` are Business Source License 1.1**
  (automatically converts to Apache 2.0 four years after each release)

The full text of each license lives at the repository root:

- [`LICENSE.apache`](./LICENSE.apache) - Apache License, Version 2.0
- [`LICENSE.bsl`](./LICENSE.bsl) - Business Source License 1.1

## Apache 2.0 folders

This is the default license for this repository. Anyone - open source projects,
commercial products, SaaS, plugin authors - can use, modify, and redistribute
these folders with no strings attached, including for any commercial purpose.

All files and folders not listed under **BSL 1.1 folders** are Apache-2.0,
including:
- `packages/core/`
- `packages/runtime/`
- `packages/rest/`
- `packages/metadata/`
- `packages/metadata-core/`
- `packages/metadata-fs/`
- `packages/objectql/`
- `packages/spec/`
- `packages/types/`
- `packages/formula/`
- `packages/observability/`
- `packages/platform-objects/`
- `packages/client/`
- `packages/client-react/`
- `packages/cli/`
- `packages/create-objectstack/`
- `packages/vscode-objectstack/`
- `packages/adapters/*/`
- `apps/docs/`
- `content/docs/`
- `examples/`
- `skills/`
- `.github/prompts/`

## BSL 1.1 folders

These are the official managed service and plugin layer. They are free to use
for almost any purpose, with one carve-out: you may not offer them as a hosted
service that competes with ObjectStack Cloud.

- `packages/services/*/`
- `packages/plugins/*/`

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
  not "ObjectStack as a service" - it is your product, which happens to use
  ObjectStack internally.
- Modify the source code, build derivative works, redistribute, and contribute
  back upstream.
- Use the software for education, research, evaluation, and non-production
  workloads of any kind.

## What you cannot do under BSL

- Offer a hosted or managed service that gives third parties access to
  ObjectStack itself as the product (a "competing offering"). This includes
  multi-tenant hosted ObjectStack, white-labeled ObjectStack platforms, and
  paid managed ObjectStack services. If this is what you want to do, contact
  `licensing@objectstack.dev` for a commercial license, or wait for the
  four-year Change Date when that version becomes Apache 2.0.

The precise wording of the carve-out is in [`LICENSE.bsl`](./LICENSE.bsl) under
"Additional Use Grant". The BSL text is authoritative.

## Plugins and the application marketplace

Third-party plugins authored against ObjectStack's public protocol surface
(`@objectstack/spec` and the Apache-licensed SDKs) are not derivative works of
ObjectStack's BSL-licensed official services or plugins. Plugin authors are
free to choose any license they want - open source, proprietary, or commercial
- for their own code.

The marketplace itself is governed by a separate Terms of Service, not by this
file.

## Contributions

Contributions to this repository are accepted under the license of the folder
being modified (Apache 2.0 for Apache-licensed folders, BSL 1.1 for
BSL-licensed folders). By submitting a contribution you agree that it may be
relicensed by ObjectStack AI LLC if the project as a whole is relicensed in the
future.

## Commercial licensing

For commercial licenses, OEM agreements, or any usage that does not fit the
terms above, contact `licensing@objectstack.dev`.
