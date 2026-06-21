---
"@objectstack/platform-objects": minor
---

Drop the unused `team` value from `sys_business_unit.kind` (ADR-0057 addendum D11).

The `team` kind collided head-on with the first-class `sys_team` object: a
`kind='team'` business unit walks the hierarchical `BusinessUnitGraphService`,
while `sys_team` is the flat better-auth collaboration grouping served by
`TeamGraphService`. `kind` is a display-only categorisation hint (it does not
change graph semantics) and had **zero** usages anywhere in the repo, so this is a
safe narrowing with no data migration. New enum:
`company | division | department | office | cost_center`.
