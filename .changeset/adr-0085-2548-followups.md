---
'@objectstack/lint': patch
'@objectstack/plugin-audit': patch
---

ADR-0085 #2548 follow-ups surfaced by the real-backend browser pass:

- **lint**: new `field-group-shadowed` warning in `validate-semantic-roles` — a
  declared fieldGroup whose every visible member is hoisted into the detail
  highlight strip (or is the record title) renders on forms but silently never
  on detail pages (detail bodies hide the first 4 highlightFields). Warning
  tier, same as the other semantic-role rules.
- **plugin-audit**: feed/audit summaries ("Created … / Deleted … / Updated …")
  now name the object by its display label ("Semantic Zoo") instead of its API
  name ("showcase_semantic_zoo") — these strings render verbatim in the record
  Discussion feed and Setup dashboards. Falls back to the API name when the
  object definition isn't resolvable. Existing stored rows are unchanged.
