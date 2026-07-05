---
title: "Tour · Security"
description: Guided tour of the security domain — roles, permission sets, the default profile, sharing rules, and row-level security.
---

# Guided tour — Security

Everything in this domain lives under `src/security/index.ts`.

## Roles, permission sets, profile

The showcase ships a role hierarchy, permission sets with object CRUD +
field-level security + row-level security, and `showcase_member_default` —
a permission set with `isProfile: true`, the fallback **profile**
(ADR-0056).

The `showcase_contributor` permission set as a live object-access matrix:

```metadata
type: permission
name: showcase_contributor
```

## Sharing

Sharing rules extend record access beyond ownership — see the
`sharingRules` wired in `objectstack.config.ts` and the private-note
object for an owner-only counter-example.

## See it enforced

Log in as a non-admin member (create one in Setup → Users, assign the
member profile): the Field Zoo's permission-gated fields mask, private
notes vanish, and write attempts outside your row scope are rejected —
the declared model, enforced end to end.

This is the last stop — back to the [overview](./showcase_index.md), or
jump to the [Data tour](./showcase_tour_data.md) to start again.
