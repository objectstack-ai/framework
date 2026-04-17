# Package README & `package.json` Publishing Checklist (Internal)

> **Audience:** Maintainers of the ObjectStack monorepo.
> **Purpose:** Guarantee every package published to npm under `@objectstack/*` has consistent, high-quality documentation and publishing metadata.
> **Status:** Canonical. All PRs that add a new package, or that modify any `README.md` or `package.json` under `packages/**`, must satisfy this checklist.

---

## 1. Canonical README Structure

Every package `README.md` MUST follow this section order. Sections that do not apply to a package can be omitted, but the order of remaining sections must not change.

```markdown
# @objectstack/<package-name>

> One-line pitch: what this package is and what problem it solves.

[![npm](https://img.shields.io/npm/v/@objectstack/<package-name>.svg)](https://www.npmjs.com/package/@objectstack/<package-name>)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Overview

2–4 sentences. Where this package sits in the ObjectStack architecture (Core / Adapter / Plugin / Driver / Service). Who should use it.

## Installation

\`\`\`bash
pnpm add @objectstack/<package-name>
# or
npm install @objectstack/<package-name>
\`\`\`

## Quick Start

Minimum runnable example — imports, construction, usage. Must reference only public exports.

\`\`\`typescript
import { ... } from '@objectstack/<package-name>';
\`\`\`

## Key Exports / API

Brief list of the most important public exports (classes, functions, types). Link to generated API reference in the docs site rather than duplicating full signatures.

## Configuration

Config options (if any) as a table. Use the same key names as the Zod schema (camelCase).

## When to use

- ✅ Good fit for scenario X.
- ✅ Good fit for scenario Y.

## When not to use

- ❌ Not a good fit for Z — use `@objectstack/other-package` instead.

## Related Packages

- [`@objectstack/spec`](../spec) — protocol schemas.
- [`@objectstack/core`](../core) — kernel and DI.
- … package-specific relations.

## Links

- 📖 Docs: <https://objectstack.ai/docs>
- 📚 API Reference: <https://objectstack.ai/docs/references>
- 🧭 Protocol: <https://objectstack.ai/docs/protocol>
- 🧪 Examples: [`examples/`](../../../examples)
- 🤖 Skill: [`skills/objectstack-<domain>/SKILL.md`](../../../skills) _(if applicable)_

## License

Apache-2.0 © ObjectStack
```

### README conventions

- **Title**: Always `# @objectstack/<package-name>` as the first line. No marketing titles above the scoped name.
- **Pitch**: Exactly one sentence. Must describe the package, not the ecosystem.
- **Badges**: npm version + Apache-2.0 license badge. Additional badges (CI, coverage) may be added but must use shields.io and be the last line of the badge block.
- **Code blocks**: Always tagged with language (`typescript`, `bash`, `json`). Imports must be from the package being documented, not relative paths.
- **API examples**: Must compile against the current published API. Verify by grepping `src/index.ts` for the symbols used.
- **Internal terminology**: Use canonical names from `packages/spec/src/kernel/metadata-plugin.zod.ts` (singular: `view`, `flow`, `agent`, `tool`, not plural).
- **Links**: Prefer absolute URLs to the docs site for user-facing references; repository-relative links are only allowed for cross-package pointers within the monorepo.

---

## 2. `package.json` Publishing Checklist

Every publishable package MUST have the following fields. Private packages (`"private": true`) are exempt but apps (under `apps/`) should stay private.

### Required fields

| Field | Requirement | Example |
|:---|:---|:---|
| `name` | Scoped `@objectstack/<slug>` | `"@objectstack/core"` |
| `version` | Aligned with monorepo release train (currently `4.0.4`) | `"4.0.4"` |
| `description` | One sentence, ≤ 140 chars, starts with product/scope | `"ObjectStack core kernel — DI, plugin lifecycle, EventBus"` |
| `license` | `Apache-2.0` | `"Apache-2.0"` |
| `author` | `"ObjectStack"` | `"ObjectStack"` |
| `keywords` | ≥ 3 tags. First must be `objectstack`. | `["objectstack", "kernel", "di"]` |
| `repository` | Object form with `directory` | see below |
| `homepage` | Package landing page on docs site | `"https://objectstack.ai/docs/packages/core"` |
| `bugs` | Issues URL | `"https://github.com/objectstack-ai/framework/issues"` |
| `engines.node` | `">=18.0.0"` | `">=18.0.0"` |
| `main` | CJS entry or `dist/index.js` | `"./dist/index.js"` |
| `types` | Type declarations entry | `"./dist/index.d.ts"` |
| `exports` | At minimum `"."`. Subpath exports must mirror `src/*` | see below |
| `files` | Whitelist: `["dist", "README.md", ...]` — never publish `src/` | `["dist", "README.md"]` |
| `publishConfig.access` | `"public"` | `"public"` |

### Canonical `repository` block

```json
"repository": {
  "type": "git",
  "url": "https://github.com/objectstack-ai/framework.git",
  "directory": "packages/<path-to-package>"
}
```

### Canonical `exports` block (single entry)

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.mjs",
    "require": "./dist/index.js"
  }
}
```

### Canonical `files` whitelist

```json
"files": ["dist", "README.md", "LICENSE"]
```

Add `json-schema`, `prompts`, `llms.txt`, etc. only when the package actually ships those assets.

### Forbidden in published packages

- `devDependencies` entries that reference deleted packages
- `main` pointing at `src/`
- Non-scoped names (`"objectstack-*"` is grandfathered only for the VS Code extension)
- `"private": true` on a package that needs to be installable from npm

---

## 3. Pre-release PR Checklist

Every release PR must verify for each package:

- [ ] README exists and matches §1 structure.
- [ ] Code examples in README reference symbols that exist in `src/index.ts`.
- [ ] `package.json` has every required field in §2.
- [ ] `version` is aligned with the release train.
- [ ] `exports` / `main` / `types` all point at `dist/` artifacts that the build actually produces.
- [ ] `pnpm build` succeeds and produces the files listed in `files`.
- [ ] `pnpm test` passes or is `--passWithNoTests` intentionally.
- [ ] `lychee` link check passes for README.
- [ ] `CHANGELOG.md` has an entry covering this package's changes.

---

## 4. Docs-site Linkage

Each package MUST have a corresponding guide page under `content/docs/guides/packages.mdx` (overview table) and a detailed reference under `content/docs/references/<domain>/<slug>.mdx` (auto-generated from Zod schemas for protocol packages; hand-written for runtime packages).

When introducing a new package:

1. Add a row to the overview table in `content/docs/guides/packages.mdx`.
2. If the package defines Zod schemas, run `pnpm --filter @objectstack/spec gen:docs`.
3. If the package is a runtime (plugin/service/driver/adapter), add a hand-written reference page under `content/docs/references/<domain>/`.
4. Update `ROADMAP.md` Package Status Matrix.

---

## 5. Deprecation / Removal

To deprecate a package:

1. Add `"deprecated": "<reason + migration hint>"` to `package.json`.
2. Prefix README with a `> **Deprecated.** Use [`@objectstack/replacement`](…) instead.` callout.
3. Move its row in `content/docs/guides/packages.mdx` into a "Deprecated" section.
4. Keep publishing patch releases until downstream migration is complete.

---

Last updated: 2026-04-17
