# ObjectStack — Developer Experience (DX) Roadmap

> **Last Updated:** 2026-02-13  
> **Scope:** Post v3.0 — Focused entirely on Developer Experience  
> **Based On:** Full codebase audit — 175 schemas, 195 test files (5,269 tests), 150+ doc pages, 4 examples, 14 packages  
> **Previous:** `ROADMAP.md` (v3.0 Phases 5–11 ✅ Complete)

---

## Executive Summary

ObjectStack v3.0 delivered a production-grade protocol spec with comprehensive type safety, test coverage, security hardening, and build tooling. The **next frontier is developer adoption** — making it effortless for developers to discover, learn, and build with the platform.

This roadmap prioritizes improvements based on the **"Time to First Wow"** metric: how quickly a new developer goes from `npm init` to a running application with data, UI, and API.

### Current DX Assessment (Feb 2026 Audit)

| Area | Score | Notes |
|------|-------|-------|
| **Type Safety** | ⭐⭐⭐⭐⭐ | Zod-first, 7,111 `.describe()`, full inference, branded types |
| **Schema Completeness** | ⭐⭐⭐⭐⭐ | 175 schemas, 1,470 JSON Schemas, OpenAPI 3.1, bundled `objectstack.json` |
| **Test Coverage** | ⭐⭐⭐⭐⭐ | 195 test files (5,269 tests), 100%+ schema coverage |
| **IDE Autocomplete** | ⭐⭐⭐⭐ | Bundled `objectstack.json`, `.describe()` tooltips, subpath exports |
| **Error Messages** | ⭐⭐⭐⭐⭐ | Custom Zod error map, "Did you mean?" fuzzy suggestions, `safeParsePretty()` |
| **Helper Functions** | ⭐⭐⭐⭐⭐ | 6 `define*` helpers + `ObjectSchema.create()` + `Field.*` + strict `defineStack()` |
| **Getting Started** | ⭐⭐⭐⭐ | Docs, StackBlitz playground; no video walkthrough yet |
| **Reference Docs** | ⭐⭐⭐⭐⭐ | Field type gallery ✅, error catalog ✅, query cheat sheet ✅, Contracts ✅ |
| **Examples** | ⭐⭐⭐⭐ | 4 examples with READMEs, "How to Run" sections, StackBlitz link |
| **Migration Story** | ⭐⭐⭐ | V3 migration guide exists; no automated codemod tooling |

---

## Completed Phases

<details>
<summary><strong>Phase 1: First Five Minutes (Onboarding) ✅ 9/10</strong></summary>

- [x] Create StackBlitz starter template from `app-todo`
- [x] Add "Try Online" button to spec README.md and docs site hero
- [x] Add "How to Run" section to each example README (app-todo, app-crm, server, plugin-bi)
- [x] Add prerequisites section to getting-started docs
- [x] Create first-run troubleshooting page
- [x] Implement `create-objectstack` CLI wizard with 3 templates
- [ ] Record 5-minute getting-started video
- [x] Fix `examples/README.md`: remove `minimal-auth` ghost reference, update metadata
- [x] Fix `plugin-bi` example: add README.md, add package.json scripts
- [x] Fix `server` (formerly app-host) README: use `pnpm dev` instead of `npm run dev`

</details>

<details>
<summary><strong>Phase 2: Schema DX Helpers ✅ 9/9</strong></summary>

- [x] Enhance `ObjectSchema.create()` with auto-label, common fields, and validation
- [x] Implement `defineView()` with column type inference
- [x] Implement `defineApp()` with navigation builder
- [x] Implement `defineFlow()` with step type inference
- [x] Create custom Zod error map with contextual messages
- [x] Add "Did you mean?" suggestions for FieldType typos
- [x] Create pretty-print validation error formatter for CLI
- [x] Add branded types for ObjectName, FieldName, ViewName
- [x] Add strict cross-reference validation mode to `defineStack()`

</details>

<details>
<summary><strong>Phase 3: Documentation & Reference ✅ 16/16</strong></summary>

- [x] Create field type gallery page with all 48 types
- [x] Create per-field-type configuration reference tables
- [x] Create error code catalog with 41+ error codes
- [x] Create HTTP status mapping reference
- [x] Create protocol relationship diagram (visual)
- [x] Create query syntax cheat sheet
- [x] Add wire format JSON examples to protocol docs
- [x] Create common patterns guide (top 10 patterns)
- [x] Create troubleshooting / FAQ page
- [x] Create plugin development tutorial
- [x] Populate Contracts docs section
- [x] Add field type decision tree ("Which field type?")
- [x] Add client-side error handling guide
- [x] Add server-side error handling guide
- [x] Add data flow diagram guide (defineStack → kernel → driver → DB)
- [x] Add security permissions matrix

</details>

---

## Phase 4: CLI & Tooling DX — 2 weeks 🔄 Active

> **Goal:** The CLI is a developer's best friend — it catches mistakes before runtime.  
> **Metric:** `objectstack doctor` catches 90%+ of common configuration mistakes.

### 4.1 CLI Enhancements

| Task | Details | Priority | Status |
|------|---------|----------|--------|
| `objectstack diff` | Compare two spec versions, detect breaking changes, output changelog | 🔴 High | ❌ |
| `objectstack doctor` improvements | Detect: circular deps, missing test files, deprecated usage, unused objects, orphan views | 🔴 High | ❌ |
| `objectstack lint` | Style checker: snake_case names, required fields, label conventions | 🟡 Medium | ❌ |
| `objectstack explain <schema>` | Print human-readable explanation of any schema with examples | 🟡 Medium | ❌ |
| `objectstack migrate` | Auto-generate migration scripts for schema changes (add/remove fields) | 🟢 Low | ❌ |

### 4.2 IDE Integration

| Task | Details | Priority | Status |
|------|---------|----------|--------|
| VSCode extension | Syntax highlighting, autocomplete, inline validation | 🔴 High | ✅ Done |
| JSON Schema for `objectstack.config.ts` | IDE autocomplete when editing config file | 🔴 High | ✅ Done |
| Diagnostic language server | Real-time validation with inline error squiggles | 🟡 Medium | ❌ |
| Code actions (quick fixes) | Auto-fix: add missing `label`, fix snake_case, add required `options` | 🟡 Medium | ❌ |

### 4.3 Code Generation

| Task | Details | Priority | Status |
|------|---------|----------|--------|
| `objectstack generate client --lang ts` | Type-safe client SDK from stack definition | 🟡 Medium | ❌ |
| `objectstack generate openapi` | OpenAPI spec from stack definition | 🟡 Medium | ❌ |
| `objectstack generate migration` | Database migration from object diff | 🟡 Medium | ❌ |
| `objectstack generate seed` | Generate seed data from object schemas | 🟢 Low | ❌ |

### 4.4 Codemod & Migration Tooling

| Task | Details | Priority | Status |
|------|---------|----------|--------|
| `objectstack codemod v2-to-v3` | Automated AST transform for v2 → v3 breaking changes | 🟡 Medium | ❌ |
| Deprecation scanner | CLI command to detect usage of `@deprecated` items | 🟡 Medium | ❌ |
| Config validator | Deep validation of `objectstack.config.ts` with cross-reference checks | 🟡 Medium | ❌ |

### Phase 4 Checklist

- [ ] Implement `objectstack diff` with breaking change detection
- [ ] Enhance `objectstack doctor` (circular deps, missing tests, deprecated usage)
- [ ] Implement `objectstack lint` for naming conventions
- [ ] Implement `objectstack explain` for schema documentation
- [x] Create VSCode extension with autocomplete and validation
- [x] Add JSON Schema for `objectstack.config.ts` IDE support
- [ ] Implement `objectstack generate client` for typed SDK generation
- [ ] Implement `objectstack generate migration` for schema diffs
- [ ] Add deprecation scanner to CLI

---

## Phase 6: Ecosystem & Community — Ongoing 📋 Planned

> **Goal:** Build a thriving ecosystem of plugins, examples, and community contributions.  
> **Metric:** 10+ community plugins published, 100+ GitHub stars.

### 6.1 Plugin Marketplace

| Task | Details | Priority |
|------|---------|----------|
| Plugin registry API | REST API for discovering, searching, and downloading plugins | 🟡 Medium |
| Plugin quality scoring | Automated scoring: tests, docs, types, security scan | 🟡 Medium |
| Plugin starter template | `objectstack generate plugin` with test setup, CI, publishing | 🔴 High |

### 6.2 Example Gallery

| Task | Details | Priority |
|------|---------|----------|
| 10+ curated examples | SaaS, eCommerce, Healthcare, Education, Project Management, etc. | 🟡 Medium |
| Example difficulty rating | Beginner / Intermediate / Advanced badges | 🟡 Medium |
| "Fork & Customize" flow | One-click fork of any example into user's own project | 🟢 Low |

### 6.3 Community Infrastructure

| Task | Details | Priority |
|------|---------|----------|
| Discord community | Developer support channel, showcase, RFC discussions | 🟡 Medium |
| Blog / Changelog | Regular updates on new features, best practices, community highlights | 🟡 Medium |
| Contributor recognition | Contributors page, "first PR" badges, hall of fame | 🟢 Low |

### Phase 6 Checklist

- [ ] Implement plugin registry API (search, publish, download)
- [ ] Create plugin starter template with CI and publishing
- [ ] Add plugin quality scoring system
- [ ] Create 10+ curated example applications
- [ ] Add example difficulty ratings
- [ ] Set up Discord community with support channels
- [ ] Create blog/changelog system for regular updates

---

## Timeline Summary

```
2026 Q1 (Complete)
 ├── Phase 1: First Five Minutes            [2 weeks]  ✅ 9/10 — Playground, quick-start, example fixes
 ├── Phase 2: Schema DX Helpers             [2 weeks]  ✅ 9/9  — define* helpers, error map, branded types
 └── Phase 3: Documentation & Reference     [3 weeks]  ✅ 16/16 — Field gallery, error catalog, contracts

2026 Q2 (Tooling Sprint)
 ├── Phase 4: CLI & Tooling DX              [2 weeks]  🔄 Active (2/10 done)
 └── Phase 5: Studio as DX Hub             [3 weeks]  📋 Planned

2026 Q3+ (Ecosystem Sprint)
 └── Phase 6: Ecosystem & Community         [Ongoing]  📋 Planned
```

---

## Success Criteria

| Metric | v3.0 (Current) | Phase 4 | Phase 5 | Phase 6 |
|--------|----------------|---------|---------|---------|
| Time to First App | ~30 min | < 10 min | < 5 min | < 3 min |
| Documentation coverage | ~95% | 95%+ | 98% | 100% |
| Interactive examples | 1 (StackBlitz) | 2+ | 3+ | 10+ |
| Community plugins | 0 | 0 | 2+ | 10+ |
| CLI diagnostic commands | 2 | 6 | 6 | 8+ |
| IDE autocomplete coverage | JSON Schema + VSCode ext | + Language Server | Full | Full |
| Helper functions (`define*`) | 6 | 6+ | 6+ | 8+ |
| Test files / Tests | 195 / 5,269 | 195+ / 5,300+ | 200+ / 5,500+ | 210+ / 6,000+ |
| Example quality | 4 working | 4+ | 6+ | 10+ |

---

## Relationship to Other Plans

| Document | Focus | Status |
|----------|-------|--------|
| `ROADMAP.md` | v3.0 complete + v4.0 enterprise readiness | ✅ v3.0 Complete · 📋 v4.0 Planning |
| `apps/studio/ROADMAP.md` | Studio IDE visual features (Phases 0–8) | 🔄 Active |
| **`DX_ROADMAP.md` (this file)** | **Developer Experience & Adoption** | 🔄 Active — Phase 4 |

---

**Last Updated:** 2026-02-13  
**Maintainers:** ObjectStack Core Team  
**Status:** ✅ Phase 1–3 Complete | 🔄 Phase 4 Active | 📋 Phase 5–6 Planned
