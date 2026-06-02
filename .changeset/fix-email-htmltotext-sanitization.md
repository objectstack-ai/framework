---
'@objectstack/plugin-email': patch
---

Harden `htmlToText` against double-escaping and incomplete tag stripping

Fixes two CodeQL high-severity alerts in `template-engine.ts`:

- `js/double-escaping`: the order-dependent chain of single-entity
  `.replace()` calls could double-unescape (e.g. `&amp;lt;` → `&lt;` → `<`).
  Entities are now decoded in a single left-to-right pass via one alternation
  regex, so each entity decodes exactly once.
- `js/incomplete-multi-character-sanitization`: the single `<[^>]+>` strip
  could leave a live tag behind on crafted/overlapping input
  (e.g. `<scr<script>ipt>`). Tag stripping now loops until the string is
  stable, and runs before entity decoding so decoding cannot re-introduce a
  tag.

Adds adversarial unit tests covering nested entities and overlapping tags.
