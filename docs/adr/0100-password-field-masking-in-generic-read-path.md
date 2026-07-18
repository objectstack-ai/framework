# ADR-0100: Mask `password` Fields on the Generic Read Path

- **Status**: Accepted
- **Date**: 2026-07-18
- **Issue**: #2036 (found via #2033 / #2025 / #2028 field-type round-trip work)
- **Relates to**: ADR-0077 (authoring-surface boundary), ADR-0078 (no silently
  inert metadata), ADR-0069 (enterprise authentication hardening)

## Context

A `password`-typed field declared on a **non-auth** object (e.g.
`showcase_field_zoo.f_password`) round-tripped **plaintext** through the generic
CRUD engine: it was stored as-is and read back verbatim over the data API. This
is unlike the `secret` field channel, which encrypts on write into `sys_secret`
and masks to `SECRET_MASK` (`••••••••`) on read, so plaintext never leaves the
engine outside a privileged `resolveSecret` call.

This is a low-code platform where field types are author-driven (often by an AI).
Someone modeling a `password` field on a custom object reasonably expects
credential-grade handling; today they silently got plaintext storage and
plaintext reads, a runtime/security trap the static gates do not catch. The
real one-way hashing lives entirely in the auth subsystem (better-auth endpoints,
the hashed `sys_account.password` `text` column) and never touches an authored
`password` field.

The issue framed four options: (1) mask on read like `secret`; (2) hash on write
in the generic path; (3) an author-time guard; (4) document as auth-only. Option
2 is the wrong fit — one-way hashing only makes sense for credential
*verification*, which a non-auth object never does, and doing it in the engine
would stand up a second, unmanaged credential store that violates the
"auth subsystem owns credentials" boundary. Option 4 leaves the silent trap in
place. This ADR adopts **1 + 3**.

## Decision

1. **Mask on read, everywhere the generic path returns rows.** A `password`
   field on a generic object is masked to `SECRET_MASK` in `find` / `findOne`
   (and therefore in `$expand`, which re-enters `find`). The read set is computed
   by `collectMaskedReadFields` (`packages/objectql/src/secret-fields.ts`), which
   returns every `secret` field plus every `password` field; `maskSecretFields`
   in `engine.ts` consumes it. `secret` behavior is unchanged.

2. **Plaintext at rest, by design.** Unlike `secret`, a `password` value is
   **not** encrypted and gets **no** `sys_secret` row — it is stored verbatim.
   Masking is a read-path transform only. This keeps the change minimal and
   avoids standing up a second credential store; it also means a `password`
   field needs no `CryptoProvider` (no fail-closed throw). Authors who need
   reversible encryption-at-rest should use `secret`.

3. **Echoed-mask write guard.** Because a read now returns `SECRET_MASK`, a
   client that reads a record and PATCHes it back would otherwise overwrite the
   stored value with the literal mask. `encryptSecretFields` drops any masked
   field (secret or password) whose incoming value equals `SECRET_MASK`, so an
   unchanged round-trip is a no-op. The one accepted cost: the literal string
   `••••••••` cannot itself be stored as a password via an echoing client.

4. **`managedBy: 'better-auth'` exemption.** The auth subsystem reads its
   identity rows through the engine's `find`/`findOne` (the better-auth ObjectQL
   adapter). Masking a credential column there would break login. Objects marked
   `managedBy: 'better-auth'` are therefore exempt from password masking. Today
   this is a safety net, not load-bearing: no shipped identity object even
   declares a `password`-typed field (`sys_account.password` is a hashed `text`
   column), pinned by a platform-objects test so retyping it becomes a
   deliberate decision rather than a silent login break.

5. **Non-fatal author-time warning (ADR-0077/0078).** `ObjectSchema.create()`
   emits a `console.warn` (deduped per object name) when a `password` field is
   declared on a non-`better-auth` object, steering authors to `Field.secret`
   for reversible machine credentials or to the auth subsystem for login
   credentials. It is a *warning*, not a build error: `password` now has a
   defined generic-path contract (so ADR-0078 does not compel an error), and the
   field-zoo example intentionally exercises every field type — a hard error
   would be self-inflicted breakage. Raw `.parse()` stays silent, since it also
   loads persisted metadata and `create()` is the authoring surface (ADR-0077).

## Consequences

- Edit forms that prefill from a read now show the mask for `password` fields —
  identical to the existing `secret` UX. Unchanged-value saves are protected by
  the echoed-mask guard (Decision 3).
- The generic read path no longer leaks credential plaintext for `password`
  fields; the field-zoo HTTP round-trip pins this (`f_password` upgraded from
  `present` to `masked`).
- This ADR also retroactively documents the `secret` field channel, resolving
  the dangling "ADR (secret field channel)" references in `field.zod.ts` and
  `secret-fields.ts`.

## Non-goals / follow-ups

- **`aggregate()` masking gap.** `aggregate()` masks neither `secret` nor
  `password` — a pre-existing gap for `secret`. Post-hoc masking of aggregate
  output would corrupt group keys; the correct fix is to *reject* aggregations
  that reference a credential field. Tracked as a separate follow-up issue, not
  addressed here.
- **Hashing / verification for authored `password` fields** — explicitly out of
  scope (Decision 2). Credential verification belongs to the auth subsystem.
