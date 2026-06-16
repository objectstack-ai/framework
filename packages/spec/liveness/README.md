# Spec liveness ledger

For a metadata-driven platform, **the spec is the product surface**: authors write
metadata against these Zod schemas. A property that is parsed but has no runtime
consumer is a silent no-op — and for a *security* property, a silent no-op is
**false compliance** (e.g. `forceMfa: true` accepted and ignored). The
metadata-liveness audits (`docs/audits/2026-06-*-property-liveness.md`) found that
large swaths of the declared surface are DEAD.

This ledger makes that classification **explicit and regression-proof**: in a
*governed* category, every authorable property must declare a liveness status with
evidence, or CI fails (the ratchet — you can't add new undeclared surface).

## Status vocabulary

| Status | Meaning |
|---|---|
| `live` | Has a runtime consumer. Cite it in `evidence` (`file:line`, or a test). |
| `experimental` / `planned` | Declared, intentionally not enforced yet. Also recognised from a spec `.describe()` marker like `[EXPERIMENTAL — not enforced]`. |
| `dead` | Parsed, no consumer. Tracked for **enforce-or-remove** (cite the audit/grep). |
| `internal` *(schema-level)* | Not authorable metadata (runtime result/DTO, context, enum). Exempt. |

Resolution order per property: **ledger entry → spec `.describe()` marker → UNCLASSIFIED**.
A schema-level `"_schema": "<status>"` applies to all its properties (used for
wholesale-dead subtrees like `PasswordPolicy`, or `internal` runtime types).
Caveat: a `_schema`-classified schema also absorbs *new* properties at that status,
so the ratchet does not flag additions to a wholesale-dead/internal subtree — only
additions to per-property schemas (the mixed ones like `ObjectPermission`,
`PermissionSet`). Use `_schema` only for subtrees that are genuinely all-one-status.

## Two governance modes

A category's ledger picks how the gate scopes it:

- **default** — *every* authorable object schema in the category must be classified
  (`"_schema": "internal"` exempts non-authorable ones). Right for clean,
  fully-authorable categories: `security`, `identity`.
- **allowlist** (`"mode": "allowlist"` + `"governed": ["Agent","Tool","Skill"]`) —
  only the named schemas are checked; the rest of the category is out of scope.
  Right for categories dominated by protocol/engine/runtime DTOs where the
  authorable types are a small subset: `ai` (Agent/Tool/Skill among embedder/
  knowledge/model DTOs). A `governed` name that no longer resolves to a schema is
  reported (catches renames that would silently drop coverage).

## Framework fields (auto-classified)

The ADR-0010 provenance/lock overlay fields — `_lock`, `_lockReason`, `_lockSource`,
`_lockDocsUrl`, `_provenance`, `_packageId`, `_packageVersion`, `protection` — appear
on every authorable type and are system-stamped, not type-specific surface. The gate
auto-classifies them `live`, so ledgers don't repeat them.

## Files

- `<category>.json` — the ledger for a governed category (`security`, `identity`, `ai`).
- `../scripts/liveness/check-liveness.mjs` — the gate. Reads the generated
  `packages/spec/json-schema/<category>/*.json`, resolves each authorable
  property's status, and exits non-zero on any UNCLASSIFIED property.

## Usage

```bash
pnpm --filter @objectstack/spec gen:schema          # produce json-schema/ (the source of truth)
pnpm --filter @objectstack/spec check:liveness      # run the gate
node packages/spec/scripts/liveness/check-liveness.mjs --dump security   # inventory a category (seeding aid)
```

CI: `.github/workflows/spec-liveness-check.yml` runs the gate on PRs touching
`packages/spec/**`.

## Rolling out the next category

Governed categories are listed in `GOVERNED` at the top of `check-liveness.mjs`,
rolled out **highest-risk-first**. To add one (e.g. `automation`, `ui`, `data`):

1. `--dump <category>` to inventory its authorable properties. **The json-schema
   categories do NOT map to "authorable types"** — most (`data`, `automation`, `ui`,
   `kernel`) are dominated by ObjectQL/engine/protocol DTOs, and some authorable
   types live elsewhere (Agent/Tool/Skill in `ai`, Dataset in `ui`). Decide the
   handful of authorable schemas and use **allowlist mode** unless the whole
   category is authorable.
2. Seed `<category>.json` from that category's liveness audit (file:line evidence)
   and targeted greps for anything the audit didn't cover. **Classify only with
   evidence** — `live` needs a cited consumer; `dead` needs a confirmed absence.
3. Add the category to `GOVERNED` and confirm the gate is green.

## Current state

| Category | Mode | Properties | Notes |
|---|---|---|---|
| `security` | default | 93 (26 live / 1 exp / 66 dead)* | ~71% parsed-but-unenforced; enforce-or-remove worklist |
| `identity` | default | 4 (3 live / 1 dead) | `Role` authorable; rest internal (SCIM/auth runtime) |
| `ai` | allowlist | 63 (46 live / 5 exp / 12 dead) | Agent/Tool/Skill; `Tool` is write-only, agent access-control dead |

\* security numbers shift to 26 / 35 / 32 once the PolicySchema experimental
markers (ADR-0049 #1882) land.

The `dead` entries are the cross-category enforce-or-remove worklist (ADR-0049).
Highest-signal: the destructive `ObjectPermission.allow{Transfer,Restore,Purge}`
(ungated), the entirely-dead `Policy` tree, and **agent `access`/`permissions`/
`visibility`** — "who can chat with this agent" is a no-op (the chat route hardcodes
`['ai:chat','ai:agents']`).
