---
"@objectstack/cli": patch
---

feat(cli): build lint warns on wrong flow-value interpolation syntax (double-brace / bare `$ref`) (#1315)

Extends the flow authoring anti-pattern lint with two advisory WARNINGs for the
interpolation-syntax mistakes AI/human authors carry over from other dialects:

- **double-brace** `{{ai_reply}}` in a flow node value — flow node values use
  SINGLE braces (`{var}`); `{{ }}` is the formula/template-field dialect, never
  flow node values (verified: no flow node executor uses `{{ }}`).
- **bare `$ref.field`** (e.g. `$source.id`) written as a plain value — it's not
  interpolated; the author meant `{source.id}` (or `{$User.Id}`).

Precise: single-brace interpolation, braced `{$User.Id}`, currency literals
(`$5.00`), and CEL condition fields are NOT flagged; never fails the build.
