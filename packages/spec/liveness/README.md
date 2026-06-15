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

## Files

- `<category>.json` — the ledger for a governed category (currently: `security`).
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
rolled out **highest-risk-first**. To add one (e.g. `automation`, `data`):

1. `--dump <category>` to inventory its authorable properties.
2. Seed `<category>.json` from that category's liveness audit (file:line evidence)
   and targeted greps for anything the audit didn't cover. **Classify only with
   evidence** — `live` needs a cited consumer; `dead` needs a confirmed absence.
3. Add the category to `GOVERNED` and confirm the gate is green.

## Current state — `security`

93 authorable properties: **66 dead, 26 live, 1 experimental.** ~71% of the
authorable security surface is parsed-but-unenforced. The `dead` entries are the
worklist for the security enforce-or-remove ADR — most urgently the destructive
`ObjectPermission.allow{Transfer,Restore,Purge}` (ungated) and the entirely-dead
`Policy` tree (password/session/`forceMfa`/network/audit).
