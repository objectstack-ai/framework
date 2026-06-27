# ADR-0075: Post-login landing resolution (configurable, opt-out-able home)

- Status: Proposed
- Date: 2026-06-27
- Deciders: platform
- Related: ADR-0007 (Settings Manifest + K/V Store + Resolver), ADR-0065 (server-driven UI / pages)

## Context

After sign-in the console must land the user *somewhere*. Today that choice is
**hardcoded in the console SPA**:

- `objectui/apps/console/src/components/CloudAwareRootRedirect.tsx` resolves `/`
  with a literal `PREFERRED_APPS = ['cloud_control']`: if the `cloud_control`
  app exists (cloud deployments) it redirects to `/apps/cloud_control`,
  otherwise it falls back to `/home`.
- `/home` renders `DefaultHomePage` (`@object-ui/app-shell` —
  `console/home/HomePage.tsx`): a generic workspace launcher ("Your apps",
  "Needs your attention", "Recently visited", "Activity").
- The app schema's `isDefault` (`spec/src/ui/app.zod.ts`) is **only a badge** —
  it does not participate in routing.

This is a framework smell, not a cloud detail. The framework bakes one
product's policy (`cloud_control`) into the shared console, and offers **no
supported way** for a deployment to either:

1. **Opt out of the outer `/home` launcher** — e.g. our own cloud service goes
   straight to its control plane and never wants the launcher; a single-app
   deployment should not show a one-tile launcher; and
2. **Customize the landing** — a customer wants their own first screen (their
   own page or app) without forking the console SPA.

The only lever today is editing `CloudAwareRootRedirect` source.

## Decision

Make the post-login landing a **resolved policy, not a hardcoded redirect**,
driven by a setting and reusing the existing Settings infrastructure
(ADR-0007). The console's root route reads a `default_landing` value and routes
accordingly; the literal `cloud_control` preference list is deleted.

### 1. The setting (`console.default_landing`)

A new Settings Manifest namespace `console` (ships with the console/app-shell
plugin, per ADR-0007 — manifests are code, values live in `sys_setting`) with
one specifier:

```
default_landing  (select/text)   default: "auto"
```

Accepted values:

| Value         | Meaning                                                              |
|---------------|---------------------------------------------------------------------|
| `auto`        | Smart fallback (see §3). The framework default.                     |
| `home`        | The workspace launcher (`DefaultHomePage`). Today's behavior.        |
| `app:<name>`  | Land directly in an app (e.g. `app:cloud_control`).                  |
| `page:<name>` | Land on a standalone SDUI page (ADR-0065) — the customer's own home. |

**Why this gives "元数据驱动 + 部署默认兜底 for free":** ADR-0007's
`SettingsService.get` resolution order is exactly the precedence we want, with
no new config mechanism:

```
1. process.env override   (source='env', locked)   ← deploy-time force (product, e.g. cloud)
2. sys_setting scope=tenant                          ← customer customization (runtime, per-tenant)
3. sys_setting scope=user                            ← optional per-user preference
4. manifest specifier.default ("auto")               ← framework default
```

- **Cloud** sets the env override (or marks `cloud_control` `isDefault` and uses
  `auto`) and **deletes its hardcode** — it becomes a plain consumer.
- **A customer** sets a tenant `sys_setting` to `page:my_home` (or `app:x`) from
  the Settings UI — **zero console rebuild**.
- **Opt out of home** = set the landing to anything other than `home`/`auto`;
  `/home` stays reachable as an explicit route, it just isn't the landing.

### 2. Wire `isDefault` into routing

`isDefault` stops being a pure badge: under `auto`, an app marked
`isDefault: true` becomes the landing. This is the metadata-native lever for
"this deployment has an obvious default app" and removes the need to name
`cloud_control` in the console.

### 3. The `auto` resolver

`auto` (the default) preserves today's behavior generically and degrades
sensibly:

1. exactly one app with `isDefault: true` → `/apps/<that app>`;
2. else exactly one visible app (`active !== false && hidden !== true`) →
   `/apps/<it>` (a single-app deployment should not show a one-tile launcher);
3. else → `/home` (the multi-app default — unchanged from today).

### 4. Console change

`CloudAwareRootRedirect` is replaced by a `LandingResolver` that reads the
resolved `console.default_landing` (exposed on the same bootstrap/metadata
payload the shell already fetches, so no extra round-trip on the hot path) and
renders the corresponding redirect/page. `DefaultHomePage` and the `/home`
route are unchanged and always reachable.

## Consequences

- The post-login landing becomes a **first-class, supported capability**:
  disable-able and customizable per deployment and per tenant, no source forks.
- The cloud-specific hardcode is deleted; cloud is demoted to a consumer that
  declares its landing like anyone else.
- `isDefault` gains real semantics (routing), closing a long-standing
  badge-only gap. (Migration note: any deployment that set `isDefault` purely
  for the badge now also gets `auto` routing to it — see Migration.)
- The earlier "AI-first welcome page" idea is no longer a special case: it is
  simply `default_landing = page:welcome`, where that page hosts the ambient
  assistant (`POST /api/v1/ai/assistant/chat`, already mounted at the
  control-plane). One mechanism, many landings.

## Migration / back-compat

- Default is `auto`, whose multi-app branch is byte-for-byte today's `/home`
  behavior → **no change for existing multi-app deployments**.
- Cloud: set the landing to `app:cloud_control` (env override) and delete
  `PREFERRED_APPS`. Behavior identical to today for cloud users, minus the
  hardcode.
- `isDefault`-as-badge deployments: if exactly one app is `isDefault` they now
  land on it under `auto`. Audit existing data; if undesirable, set
  `default_landing = home` explicitly (one tenant setting).

## Alternatives considered

- **Wire `isDefault` only, no setting.** Covers "default app" but not
  `page:<custom>` (customer custom home) nor per-tenant override — fails the
  "customize" requirement.
- **Deploy-time-only config (app-shell prop / env var).** Simpler boundary but
  no runtime, per-tenant customization — a multi-tenant runtime can't give two
  tenants different homes without two builds. Rejected in favor of the
  settings-driven approach (the env override path still exists for product-level
  force).
- **New bespoke `landing` metadata type.** Redundant: ADR-0007 settings already
  provide storage + the exact resolution order we want.

## Implementation sketch (phased)

1. **framework (spec):** `console` settings manifest with `default_landing`;
   document `isDefault` routing semantics on `app.zod.ts`.
2. **objectui (console + app-shell):** `LandingResolver` replacing
   `CloudAwareRootRedirect`; read resolved setting from bootstrap; implement the
   `auto` resolver; keep `/home` + `DefaultHomePage` intact.
3. **cloud:** set `console.default_landing` (env override) to
   `app:cloud_control`; delete the `PREFERRED_APPS` hardcode reliance.
4. **(optional, separate)** ship `page:welcome` (AI-first ambient-assistant
   landing) as the cloud landing, proving the `page:<name>` path end-to-end.
