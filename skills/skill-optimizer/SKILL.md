---
name: skill-optimizer
description: >
  Audit and optimize SKILL.md files for agent discoverability and self-containment.
  Use when skills have broken references, unreachable file paths, missing bundled assets,
  vague descriptions, or are not loading correctly after installation. Diagnose why agents
  can't find or use a skill, fix progressive loading issues, and ensure portability.
license: Apache-2.0
metadata:
  author: objectstack-ai
  version: "1.0"
  domain: meta
  tags: skill, audit, optimize, references, progressive-loading, agent
---

# Skill Optimizer — Audit & Fix Agent Skills

Expert instructions for diagnosing and fixing SKILL.md files so that AI agents
can actually discover, load, and use them — especially after installation in a
different project or distribution via `npx skills add`.

---

## When to Use This Skill

- A skill was installed but the agent **can't access referenced files**
- Agents **don't discover** a skill automatically (description triggers missing)
- References point to **absolute workspace paths** that don't exist externally
- The `references/` folder has files but **SKILL.md never links to them**
- A skill works in the monorepo but **breaks after distribution**
- You want to **audit all skills** in a project for quality

---

## Core Problem: Broken Progressive Loading

The agent loads skills in 3 stages:

1. **Discovery** (~100 tokens) — reads `name` + `description` from frontmatter
2. **Instructions** (<5000 tokens) — loads SKILL.md body when relevant
3. **Resources** — loads additional files **only when referenced via relative paths**

**Stage 3 fails** if references use workspace-absolute paths like:
```markdown
## References
- Zod source: `packages/spec/src/data/field.zod.ts`  ❌ plain text, not a link
```

The agent sees this as plain text, not a loadable resource. The file also doesn't
exist after installation. The fix:

```markdown
## References
- [field.zod.ts](./references/data/field.zod.ts) — FieldType enum  ✅ relative link to real source
- [Schema index](./references/_index.md) — All bundled schemas  ✅ auto-generated index
```

**Best practice**: If your skill documents schemas defined in Zod, copy the actual
`.zod.ts` files into `references/` using a build script. AI agents read Zod
natively — no need to manually convert to markdown. Use `build-skill-references.ts`
as a reference implementation.

---

## Audit Procedure

### Step 1: Inventory All Skills

List all skill directories in the project:

```
skills/
.github/skills/
.agents/skills/
```

For each skill, verify:
- [ ] `SKILL.md` exists and `name` matches folder name
- [ ] `description` is present and keyword-rich (< 1024 chars)
- [ ] `references/` folder exists (if skill needs supplementary data)

### Step 2: Check References Section

For each SKILL.md, inspect the `## References` section at the bottom:

| Pattern | Status | Fix |
|:--------|:-------|:----|
| `[name](./references/domain/...)` | ✅ Best | Zod source files — highest precision |
| `` `packages/spec/src/...` `` | ❌ Broken | Copy Zod source into `./references/` |
| `content/docs/references/...` | ❌ Broken | Extract content into `./references/` |
| No references section | ⚠️ Missing | Add if skill needs external data |

**Recommended structure** (Zod sources with auto-generated index):
```markdown
## References
- [field.zod.ts](./references/data/field.zod.ts) — FieldType enum
- [Schema index](./references/_index.md) — All bundled schemas
```

### Step 3: Validate Bundled Assets

For each file linked from SKILL.md:
- [ ] File exists at the path SKILL.md links to
- [ ] Content is self-contained (not just "see source at ...")
- [ ] File is < 200 lines (progressive loading token budget)

### Step 4: Check Description Quality

The `description` field is the **discovery surface**. If trigger keywords aren't
in the description, the agent won't load the skill.

**Bad:**
```yaml
description: "A skill for data design"
```

**Good:**
```yaml
description: >
  Design ObjectStack data schemas (Objects, Fields, Validations, Indexes).
  Use when creating or modifying business object definitions, choosing field types,
  configuring relationships, or setting up validation rules.
```

**Checklist for description:**
- [ ] States **what** the skill does (first sentence)
- [ ] States **when** to use it ("Use when..." pattern)
- [ ] Contains **domain keywords** agents would search for
- [ ] Under 1024 characters

### Step 5: Check SKILL.md Size

- [ ] Body is under 500 lines (ideally 200–400)
- [ ] Detailed tables/enums are in `./references/` , not inline
- [ ] SKILL.md focuses on **procedures and decisions**, not raw data

---

## Fix Templates

### Convert Absolute References to Bundled Links

Before (broken):
```markdown
## References

- Zod source: `packages/spec/src/ai/agent.zod.ts`
- Documentation: `content/docs/references/ai/`
```

After (working):
```markdown
## References

- **[Agent Schema Reference](./references/agent-schema.md)** — Properties, enums, config
- **[RAG Pipeline Reference](./references/rag-pipeline.md)** — Vector stores, chunking, retrieval

> **Monorepo source** (for contributors): `packages/spec/src/ai/agent.zod.ts`, `rag-pipeline.zod.ts`
```

### Create a Missing Reference File

```markdown
# {Domain} — {Topic} Reference

> Auto-derived from `{source-file}`.
> This file is bundled with the skill for offline/external use.

## {Section}

| Property | Required | Description |
|:---------|:---------|:------------|
| ...      | ...      | ...         |
```

### Fix Vague Description

Before:
```yaml
description: "Schema design helper"
```

After:
```yaml
description: >
  Design ObjectStack data schemas (Objects, Fields, Validations, Indexes).
  Use when creating business object definitions, choosing field types from
  48 supported types, configuring lookup/master-detail relationships,
  or setting up validation rules in an ObjectStack project.
```

---

## Common Anti-Patterns

| Anti-Pattern | Why It Fails | Fix |
|:-------------|:-------------|:----|
| References as plain text paths | Agent can't load; path doesn't exist after install | Use `[name](./references/file.md)` relative links |
| "Source of truth is elsewhere" in reference file | Skill isn't self-contained | Bundle actual content in the reference file |
| SKILL.md > 500 lines | Exceeds progressive loading token budget | Extract tables/enums to `./references/` |
| Description without trigger keywords | Agent can't discover the skill | Add "Use when..." with domain keywords |
| `name` doesn't match folder name | Silent failure, skill won't load | Rename folder or fix frontmatter `name` |
| Reference file > 200 lines | May blow token budget on load | Split into multiple focused reference files |

---

## Verification Checklist

After optimizing, verify each skill:

- [ ] `name` in frontmatter matches folder name
- [ ] `description` has "Use when..." with keywords
- [ ] All `## References` entries use `./references/` relative links
- [ ] Every linked reference file actually exists
- [ ] Reference files are self-contained (not just pointers)
- [ ] SKILL.md body < 500 lines
- [ ] Each reference file < 200 lines
- [ ] Skill works after copying to a fresh project (no external deps)

---

## References

- **[Audit Checklist](./references/audit-checklist.md)** — Quick-reference checklist for skill audits
