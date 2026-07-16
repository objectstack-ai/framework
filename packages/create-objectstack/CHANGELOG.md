# create-objectstack

## 15.1.0

### Minor Changes

- 8fc1208: feat(protocol): complete ADR-0087 — load-seam handshake, chain backfill 12–15, release artifacts (#2643)

  Closes the remaining ADR-0087 gaps (see the ADR's as-built Addendum):

  - **P0 load seams (D1).** The protocol handshake now runs on the boot-time
    durable-package rehydration path (`@objectstack/service-package` refuses an
    incompatible `sys_packages` row with the structured `OS_PROTOCOL_INCOMPATIBLE`
    diagnostic and keeps booting) and on `AppPlugin` for code-defined stacks
    (fail-fast before the manifest is decomposed). `objectstack lint` gains
    `protocol/missing-engines-range` (warning + fix-it) and the
    `create-objectstack` blank template stamps `engines: { protocol: '^<major>' }`
    (re-stamped at version time by `scripts/sync-template-versions.mjs`) — the
    two ends of the grandfathering ratchet.
  - **Chain backfill (D2/D3).** `MetadataConversion.retiredFromLoadPath`
    implements the load-window's second half (retired entries replay only via
    `migrate meta` / fixture CI). Steps 12–15 land: the `api.requireAuth` flip
    (semantic), the ADR-0090 wave (3 retired conversions + 5 semantic TODOs), the
    `BookAudience` rename (retired conversion), and the ADR-0089 visibility
    unification (`visibleOn`/`visibility` → `visibleWhen` as LIVE load-window
    conversions) + the `.strict()` flip (semantic). The protocol-11
    `compactLayout` → `highlightFields` rename is backfilled as a retired step-11
    conversion. `migrate meta --from 10` now reaches protocol 15.
  - **Release artifacts (D4).** `spec-changes.json` is generated from the
    registries (`gen:spec-changes`, CI drift-checked), ships in the npm artifact
    together with `api-surface.json`, and is attached to each `@objectstack/spec`
    GitHub Release with `added[]`/`removed[]` filled from the api-surface diff
    against the previously published release. The upgrade guide
    (`docs/protocol-upgrade-guide.md`) is generated from the same registries and
    CI drift-checked — a projection that cannot drift.

- a79e179: Scaffolded projects are now container-ready out of the box: the `blank` template ships a `Dockerfile` (two-stage build onto the official `ghcr.io/objectstack-ai/objectstack` runtime image), a `docker-compose.yml` (app + Postgres single-host stack), and a `.dockerignore`, plus a Deploy section in the project README. `docker build -t my-app .` works immediately after `npm create objectstack`.

## 15.0.0

## 14.8.0

### Patch Changes

- eaff014: Scaffolded projects now install the current framework release instead of a stale major. The bundled `blank` template had `^6.0.0` ranges frozen in while the registry was publishing 14.x, so `npm create objectstack` produced a project eight majors behind the docs — and the template's code no longer compiled against 14.x anyway (`Field.longText` removed, `api.rest` no longer a `defineStack` key, `sharingModel` now required by the ADR-0090 security gate). The template is updated to the current API, and the scaffolder now rewrites every `@objectstack/*` range in the generated `package.json` to `^<its own version>` (all packages version in lockstep), so generated projects track the release even if the committed template drifts again. A consistency test ratchets the template's major and the README's template table against the registry. The template README also documents the seeded dev-admin sign-in that data-API curls need.

## 14.7.0

## 14.6.0

## 14.5.0

## 14.4.0

## 14.3.0

## 14.2.0

## 14.1.0

## 14.0.0

## 13.0.0

## 12.6.0

## 12.5.0

## 12.4.0

## 12.3.0

## 12.2.0

## 12.1.0

## 12.0.0

## 11.10.0

## 11.9.0

## 11.8.0

## 11.7.0

## 11.6.0

## 11.5.0

## 11.4.0

## 11.3.0

## 11.2.0

## 11.1.0

## 11.0.0

## 10.3.0

## 10.2.0

## 10.1.0

### Minor Changes

- 7cf283a: Make `os validate` the author-time verification gate and steer scaffolds toward it.

  - **`os validate`** now runs the same CEL/predicate gate as `os build`/`os compile`
    (ADR-0032): every `visible`/`disabled`/`requiredWhen`/validation/flow/sharing
    predicate is checked for CEL syntax and `record.<field>` existence on the target
    object. It already ran the protocol schema and widget-binding checks; the
    expression gate closes the gap so a bare field ref (`done` instead of
    `record.done`) — which silently hides an action on every record at runtime
    (#2183/#2185) — fails validation instead of shipping. `os validate` is now a
    read-only superset of the build's checks (no artifact emitted).
  - **`create-objectstack`** now emits an `AGENTS.md` (and `.github/copilot-instructions.md`)
    into every generated project instructing coding agents to run `npm run validate`
    after editing metadata, aligns the blank template's `dev`/`start` scripts with the
    example apps (`objectstack dev`/`objectstack start`), and sharpens the post-create
    "Next steps" output.

## 10.0.0

## 9.11.0

## 9.10.0

## 9.9.1

## 9.9.0

## 9.8.0

## 9.7.0

## 9.6.0

## 9.5.1

## 9.5.0

## 9.4.0

## 9.3.0

## 9.2.0

## 9.1.0

## 9.0.1

## 9.0.0

## 8.0.1

## 8.0.0

## 7.9.0

## 7.8.0

## 7.7.0

## 7.6.0

## 7.5.0

## 7.4.1

## 7.4.0

## 7.3.0

## 7.2.1

## 7.2.0

## 7.1.0

## 7.0.0

## 6.9.0

## 6.8.1

## 6.8.0

## 6.7.1

## 6.7.0

## 6.6.0

## 6.5.1

## 6.5.0

## 6.4.0

### Patch Changes

- 15fc484: Upgrade `@object-ui/*` packages to **v6.0**.

  - `@objectstack/cli`: `@object-ui/console` and `@object-ui/studio` from `^5.4.2` → `^6.0.0` — bundled Studio + Console assets now ship the v6 UI shell (new design language, refreshed sidebar, redesigned record header).
  - `@objectstack/account`: `@object-ui/i18n` from `^5.4.2` → `^6.0.0` — i18n runtime now matches the v6 console/studio API.
  - Root devDependency `@object-ui/console` from `^5.4.2` → `^6.0.0` so workspace scripts and the docs build pick up v6.
  - `create-objectstack`: `tar` from `^7.4.3` → `^7.5.15` (security + perf fixes when unpacking remote templates).

  **Heads-up for consumers:** `@object-ui/*` v6 is a major release of the bundled UI; pages rendered through the CLI's `studio` / `console` mounts may look different from v5. The protocol surface is unchanged.

## 6.3.0

## 6.2.0

## 6.1.1

## 6.1.0

## 6.0.0

## 5.2.0

## 5.1.0

## 5.0.0

## 4.2.0

## 4.1.1

## 4.1.0

## 4.0.5

### Patch Changes

- 15e0df6: chore: unify all package versions to a single patch release

## 4.0.4

## 4.0.3

## 4.0.2

## 4.0.0

## 3.3.1

## 3.3.0

## 3.2.9

## 3.2.8

## 3.2.7

## 3.2.6

## 3.2.5

## 3.2.4

## 3.2.3

## 3.2.2

## 3.2.1

## 3.2.0

## 3.1.1

## 3.1.0

## 3.0.11

## 3.0.10

## 3.0.9

## 3.0.8
