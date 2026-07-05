---
title: "Tour · Data"
description: Guided tour of the data domain — objects, fields, relationships, validations, hooks, seed data, extensions, and the analytics cube.
---

# Guided tour — Data

Everything in this domain lives under `src/data/` and follows the dual-track
design: a **realistic backbone** (Account → Project → Task, plus Team,
Category, Invoice…) so every screen renders real seeded data, and **specimen
objects** (`field-zoo`, `semantic-zoo`) that exhaust protocol variants.

## Objects & fields

- **Field Zoo** (navigation → Data Model → Field Zoo) declares every field
  type the protocol knows — the coverage test introspects `FieldTypeSchema`
  and fails if a new type appears without a specimen here.
- The backbone shows the relationship kinds in context: `lookup`
  (Project → Account), `master_detail` (Task → Project), a self-referencing
  tree (Category → parent), and a many-to-many junction
  (`showcase_project_membership`).

## Validations — enforced, and only enforced, rules

Rules are authored inline on the object. This tour only demonstrates the
rule types the runtime actually enforces on the write path
(`state_machine`, `script`/`cross_field`, `format`, `json_schema`,
`conditional` — see `src/data/objects/account.object.ts` and the write-path
test in `test/validation.test.ts`).

A Task's legal status moves are governed by a `state_machine` rule —
rendered live from the metadata, not a screenshot:

```metadata
type: state_machine
object: showcase_task
name: task_status_flow
```

## Hooks & seed data

- `src/data/hooks/` — data-layer lifecycle hooks (before/after CRUD).
- `src/data/seed/` — the seed dataset that makes every view render something
  real on first boot.

## Extensions & analytics

- `src/data/extensions/account.extension.ts` — an **object extension**
  merged additively into `showcase_account` at registration (the mechanism a
  package uses to extend an object it doesn't own). Open an Account form:
  Loyalty Tier / LinkedIn URL / CSAT Score come from the overlay.
- `src/data/analytics/showcase.cube.ts` — the `showcase_delivery` **cube**,
  served by the analytics service at `/api/v1/analytics/*`.

Continue with the [UI tour](./showcase_tour_ui.md), or go back to the
[overview](./showcase_index.md).
