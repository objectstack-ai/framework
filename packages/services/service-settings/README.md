# @objectstack/service-settings

Settings service for ObjectStack. Implements ADR-0007: a generic
namespace **manifest** mechanism + a single K/V table (`sys_setting`) +
a resolver that layers `Env > Tenant > User > Default`.

## What it gives you

- `SettingsServicePlugin` — registers the `sys_setting` schema, exposes
  a `settings` service in the kernel, and mounts REST routes on the
  HTTP server (when one is available).
- `SettingsService` (`kernel.getService('settings')`)
  - `get(ns, key, ctx)` / `getNamespace(ns, ctx)` — resolved values with
    `{ value, source, locked }`.
  - `set(ns, key, value, scope, ctx)` / `setMany(...)` — writes that
    persist into `sys_setting`. Throws when the effective value is
    locked by env.
  - `registerManifest(manifest)` / `listManifests()` / `getManifest(ns)`.
  - `runAction(ns, actionId, input, ctx)` — for "test connection",
    "rotate", etc. declared in `action_button` specifiers.
- REST routes (default base path `/api/settings`):
  - `GET    /api/settings`                       → manifests visible to caller
  - `GET    /api/settings/:namespace`            → `{ manifest, values }`
  - `PUT    /api/settings/:namespace`            → batch upsert
  - `POST   /api/settings/:namespace/:actionId`  → invoke declared action

## Env override

`process.env[NAMESPACE_KEY]` (uppercased) takes precedence over any
stored value. Such fields are returned with `source: 'env', locked:
true` and writes (service or REST) fail with HTTP 409.

## Encryption

`Specifier.encrypted: true` (implicit for `password`) round-trips the
value through a pluggable `CryptoAdapter`. The default
`NoopCryptoAdapter` is a base64 wrapper — production deployments must
provide a real KMS adapter via plugin options.

## Audit

Every write emits a `sys_audit_log` row (when the audit service is
present). Encrypted values are masked with `'<encrypted>'` + checksum.

## Always-on default

`SettingsServicePlugin` is part of the **default capability slate** —
it is auto-mounted by `objectstack serve` (any preset except
`--preset minimal`) and by `mountDefaultProjectPlugins()` on every
per-project kernel on hosted objectos. Apps no longer need to declare
`requires: ['settings']`. Apps with zero registered manifests pay
no runtime cost (the registry is empty, no routes fire).

The Settings hub in `apps/console` therefore appears in every app, and
the **Mail Settings** card is the first manifest registered (by
`EmailServicePlugin`, also always-on).
