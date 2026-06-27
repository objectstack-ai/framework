# ADR-0075: Post-login landing resolution (metadata-declared, opt-out-able home)

- Status: Proposed
- Date: 2026-06-27
- Deciders: platform
- Related: ADR-0065 (server-driven UI / pages), app `isDefault` + `homePageId` (spec/src/ui/app.zod.ts)

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
- The app schema's `isDefault` (`spec/src/ui/app.zod.ts:502`) is **only a
  badge** — it does not participate in routing. Apps already carry
  `homePageId` (`app.zod.ts:562`, "the navigation item to serve as landing
  page") to pick the landing *within* an app.

This is a framework smell, not a cloud detail: the framework bakes one product's
policy (`cloud_control`) into the shared console, and offers **no supported
way** for a deployment to either opt out of the outer `/home` launcher or land
somewhere custom — short of forking the SPA.

### Who actually decides this, and when

The post-login landing is a **product-definition decision made at build /
development time** by whoever builds a product on the framework (the platform
for cloud; an ISV/customer for their own product), declared in **metadata /
source**. It is **not** a runtime, per-tenant, end-admin preference toggled in a
Settings UI. (An earlier draft of this ADR hung it on the Settings Manifest /
`sys_setting` runtime store; that is rejected below — it adds a UI surface and a
per-tenant runtime story nobody needs.)

## Decision

Resolve the landing from **existing app metadata**, declared in source by the
product developer. No new settings UI, no per-tenant runtime store.

### 1. Wire `isDefault` into root routing (the one behavioral change)

`isDefault` stops being a pure badge. The root route lands in the app marked
`isDefault: true`; that app's existing `homePageId` then selects the landing
*page* inside it. This is the single new semantic.

- **Cloud**: `cloud_control` is already `isDefault: true` → root lands there,
  and its `homePageId` serves the welcome / AI page. The `PREFERRED_APPS`
  hardcode is deleted; cloud becomes a plain consumer.
- **An ISV/customer product**: mark your app `isDefault` and set its
  `homePageId` to your custom landing page (an ADR-0065 SDUI page). "Custom
  home" = an app + its `homePageId` — no separate top-level page-landing concept
  and no settings namespace required.

### 2. Fallback resolver (no app declares `isDefault`)

1. exactly one app with `isDefault: true` → `/apps/<that app>`;
2. else exactly one visible app (`active !== false && hidden !== true`) →
   `/apps/<it>` (a single-app deployment should not show a one-tile launcher);
3. else → `/home` (today's multi-app default, unchanged).

### 3. Ops escape hatch (optional, secondary)

A deploy-time env override (e.g. `OS_CONSOLE_DEFAULT_LANDING=app:<name>` /
`home`) for the rare case where ops must force a landing without touching
product metadata. This is a secondary path; **metadata is the source of truth**.

### 4. Console change

`CloudAwareRootRedirect` is replaced by a generic `LandingResolver` implementing
§1–§3 over the metadata the shell already fetches (no extra hot-path round-trip).
`DefaultHomePage` and the `/home` route are unchanged and always reachable.

## Explicitly NOT doing

- **No `console.default_landing` Settings-Manifest namespace, no per-tenant
  `sys_setting`, no Settings UI.** The landing is a product-definition concern
  fixed at dev time, not an admin preference.
- **No "different landing per tenant at runtime."** Out of scope — a product's
  landing is declared once in its metadata. (A multi-tenant *host* like cloud
  still has exactly one landing: its control plane.)

## Consequences

- Minimal change, reusing fields that already exist (`isDefault` +
  `homePageId`): the only real work is one resolver in objectui replacing a
  hardcode.
- The cloud-specific hardcode is deleted; cloud is demoted to a consumer that
  declares its landing like anyone else (and already does, via `isDefault`).
- `isDefault` gains real semantics (routing), closing a badge-only gap.
- The earlier "AI-first welcome page" idea is just `cloud_control`'s
  `homePageId` pointing at a page that hosts the ambient assistant
  (`POST /api/v1/ai/assistant/chat`, already mounted control-plane-side). One
  mechanism, declared in metadata.
- Likely **no framework spec change** beyond documenting `isDefault`'s routing
  semantics — the change is concentrated in objectui.

## Migration / back-compat

- No app declares `isDefault` → `auto` fallback's multi-app branch is
  byte-for-byte today's `/home` behavior → **no change for existing multi-app
  deployments**.
- Deployments that set `isDefault` purely for the badge and have exactly one
  such app now **land on it**. Audit existing metadata; if undesired, unset
  `isDefault` (or use the env override to force `home`).
- Cloud: behavior identical to today (still lands on `cloud_control`), minus the
  `PREFERRED_APPS` hardcode.

## Alternatives considered

- **Settings-Manifest UI namespace + per-tenant `sys_setting` (this ADR's first
  draft).** Rejected: the landing is a dev-time product decision, not a runtime
  admin preference; it would add a Settings surface and a per-tenant runtime
  story that isn't a real requirement.
- **Deploy-time env var as the primary mechanism.** Kept only as a secondary ops
  override; metadata declared in product source is the source of truth, so that
  a product's landing travels with the product, not its deployment config.
- **A new bespoke top-level `landing` / `page:<name>` metadata.** Redundant:
  `isDefault` (which app) + `homePageId` (which page in it) already express it.

## Implementation sketch (phased)

1. **objectui (console + app-shell):** `LandingResolver` replacing
   `CloudAwareRootRedirect` — implement §1 (isDefault → app → homePageId), §2
   (fallback), §3 (optional env override); keep `/home` + `DefaultHomePage`
   intact.
2. **framework (spec):** document `isDefault`'s routing semantics on
   `app.zod.ts` (no new field expected).
3. **cloud:** delete the `PREFERRED_APPS` hardcode reliance; `cloud_control` is
   already `isDefault` so behavior is preserved.
4. **(optional, separate)** point `cloud_control.homePageId` at an AI-first
   ambient-assistant page, proving the custom-landing path end-to-end.
