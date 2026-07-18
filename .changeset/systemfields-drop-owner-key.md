---
"@objectstack/spec": minor
---

fix(spec): drop the dead `systemFields.owner` key (#3175 follow-up)

`ObjectSchema.systemFields` exposed an `owner?: boolean` opt-out key that nothing
read — the registry (`applySystemFields`) only consumes `systemFields.tenant` and
`systemFields.audit`, and `owner_id` provisioning is governed by the object-level
`ownership` property (`'user' | 'org' | 'none'`, made first-class in #3185). The
key was declared but wired to nothing.

Removed it so the schema only advertises the two opt-outs it actually honors
(`tenant`, `audit`). Backward-compatible at runtime: the key was ignored before and
is stripped now (both no-ops). A TypeScript author who set `systemFields.owner`
will now see an excess-property error — the fix is to delete the key (it never did
anything) or use `ownership: 'org' | 'none'` to skip `owner_id`. Also corrected the
stale `objectql/security` doc that called `audit` "reserved" (it is active).
