---
name: objectstack-hooks
description: >
  ⚠️ DEPRECATED: This skill has been integrated into objectstack-data.
  Please use the objectstack-data skill and refer to rules/hooks.md for
  data lifecycle hook documentation.
license: Apache-2.0
compatibility: Requires @objectstack/spec v4+, @objectstack/objectql v4+
metadata:
  author: objectstack-ai
  version: "1.0"
  domain: hooks
  tags: hooks, lifecycle, validation, business-logic, side-effects, data-enrichment
  deprecated: true
  replacement: objectstack-data
---

# ⚠️ DEPRECATED: Hooks Skill Migrated

This skill has been **deprecated** and integrated into the **objectstack-data** skill.

## Migration

For data lifecycle hook documentation, please use:

**New location:** [`objectstack-data/rules/hooks.md`](../objectstack-data/rules/hooks.md)

## Rationale

Hooks are a core part of data operations and are best documented alongside object definitions, field types, and validations. The objectstack-data skill now provides comprehensive coverage of:

- Object and field schema design
- Validation rules
- Index strategy
- **Data lifecycle hooks** (before/after patterns, all 14 events)

This consolidation reduces skill overlap and makes it easier for AI assistants to understand the complete data layer in ObjectStack.

## What Was Moved

All content from this skill is now available at:

- **Full documentation:** [`../objectstack-data/rules/hooks.md`](../objectstack-data/rules/hooks.md)
- **Parent skill:** [`../objectstack-data/SKILL.md`](../objectstack-data/SKILL.md)

The objectstack-data skill now includes:
- Hook definition schema
- Hook context API
- 14 lifecycle events (before/after for find/insert/update/delete, etc.)
- Common patterns (validation, defaults, audit logging, workflows)
- Performance considerations
- Testing hooks
- Best practices

---

## Quick Reference (for backwards compatibility)

For hook lifecycle documentation, see:

- [objectstack-data/rules/hooks.md](../objectstack-data/rules/hooks.md) — Complete hook documentation
- [objectstack-data/SKILL.md](../objectstack-data/SKILL.md) — Data skill overview

For kernel-level hooks (kernel:ready, kernel:shutdown, custom plugin events), see:

- [objectstack-kernel/rules/hooks-events.md](../objectstack-kernel/rules/hooks-events.md) — Kernel hook system
- [objectstack-kernel/SKILL.md](../objectstack-kernel/SKILL.md) — Kernel skill overview
