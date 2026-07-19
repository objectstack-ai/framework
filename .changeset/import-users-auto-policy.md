---
"@objectstack/plugin-auth": minor
---

**Bulk user import defaults to `auto` — prefer invite per row, temporary only for undeliverable rows (#3236).** The identity import endpoint (`POST /api/v1/auth/admin/import-users`) gains a fourth `passwordPolicy`, **`auto`**, and it is now the **default** (was `none`).

`auto` decides **per row** instead of forcing one policy on the whole batch:

- a row with a deliverable channel — a **real email + a wired email service**, or a **phone + a wired SMS-invite path** — is **invited** (a set-your-password email, or an invitation SMS for phone-only rows), so no shared secret ever leaves the server;
- a row with **no** deliverable channel (placeholder email, phone-only without SMS, or an email row when no email service is wired) falls back to a **temporary password**, returned once in the response with `must_change_password` stamped.

This shrinks the temporary-password blast radius from "the whole batch" to "only the rows that genuinely can't be reached", and — unlike `invite` — `auto` **never rejects the request for missing infrastructure**: with nothing wired, every row simply degrades to temporary. The per-row outcome is surfaced on `rows[].delivery` (`email` / `sms` / `temporary`) with a batch breakdown on `summary.delivery` (also recorded in the run audit).

The three existing policies are unchanged and still selectable explicitly:

- `invite` — force the invite path for every row; unreachable rows are **failed** per-row (never downgraded). Pick this when a temporary-password fallback is unacceptable.
- `temporary` — force a generated temporary password for every row.
- `none` — identity only, no password and no invitation.

**Behavior change to note:** callers that **omit** `passwordPolicy` previously got `none` (no credential, no outbound message); they now get `auto`, which proactively sends invitations to deliverable rows (and returns temporary passwords for the rest). Callers that want the old identity-only behavior must pass `passwordPolicy: 'none'` explicitly. Every call that already passes an explicit policy is unaffected, and the response is a strict superset (adds the `delivery` fields).
