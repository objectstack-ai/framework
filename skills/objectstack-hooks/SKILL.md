---
name: objectstack-hooks
description: >
  ⚠️ DEPRECATED: This skill has been integrated into objectstack-schema.
  Please use the objectstack-schema skill and refer to rules/hooks.md for
  data lifecycle hook documentation.
license: Apache-2.0
compatibility: Requires @objectstack/spec v4+, @objectstack/objectql v4+
metadata:
  author: objectstack-ai
  version: "1.0"
  domain: hooks
  tags: hooks, lifecycle, validation, business-logic, side-effects, data-enrichment
  deprecated: true
  replacement: objectstack-schema
---

# ⚠️ DEPRECATED: Hooks Skill Migrated

This skill has been **deprecated** and integrated into the **objectstack-schema** skill.

## Migration

For data lifecycle hook documentation, please use:

**New location:** [`objectstack-schema/rules/hooks.md`](../objectstack-schema/rules/hooks.md)

## Rationale

Hooks are a core part of data operations and are best documented alongside object definitions, field types, and validations. The objectstack-schema skill now provides comprehensive coverage of:

- Object and field schema design
- Validation rules
- Index strategy
- **Data lifecycle hooks** (before/after patterns, all 14 events)

This consolidation reduces skill overlap and makes it easier for AI assistants to understand the complete data layer in ObjectStack.

## What Was Moved

All content from this skill is now available at:

- **Full documentation:** [`../objectstack-schema/rules/hooks.md`](../objectstack-schema/rules/hooks.md)
- **Parent skill:** [`../objectstack-schema/SKILL.md`](../objectstack-schema/SKILL.md)

The objectstack-schema skill now includes:
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

- [objectstack-schema/rules/hooks.md](../objectstack-schema/rules/hooks.md) — Complete hook documentation
- [objectstack-schema/SKILL.md](../objectstack-schema/SKILL.md) — Schema skill overview

For kernel-level hooks (kernel:ready, kernel:shutdown, custom plugin events), see:

- [objectstack-plugin/rules/hooks-events.md](../objectstack-plugin/rules/hooks-events.md) — Plugin hook system
- [objectstack-plugin/SKILL.md](../objectstack-plugin/SKILL.md) — Plugin skill overview
