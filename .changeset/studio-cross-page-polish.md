---
"@objectstack/studio": patch
---

Studio: cross-page polish — calmer cards, plain-English copy, deduped registry.

Following the Airtable-style object-page redesign, this pass cleans
up the rest of the surface so every page reads the same way.

**List cards** (`MetadataListPage`):

- Suppress the per-card type badge on single-type pages (Objects,
  Forms). The page title already conveys the type; the badge was
  noise. Multi-type pages (Views & Apps, Automations, AI, Security)
  keep the badge for disambiguation.
- Show the metadata's own `description` when present, instead of
  the now-redundant snake_case `name` (which was a duplicate of the
  `<code>` element below). The machine name still appears as a
  subtle code line.
- Switch the "Preview" verbose button to an icon-only ghost button
  that reveals on hover, freeing the row for the actual label.
- Add `title` attributes everywhere so truncated labels (e.g.
  "Campaign Me…") are readable on hover.

**Home / `DeveloperOverview`**:

- Replace the "Developer Console" terminal-icon header with the
  package name and a one-line summary — feels like a product home,
  not a dev tool.
- Dedupe the Metadata Registry list: the backend currently exposes
  both `sharingRule` and `sharing_rule` (and `ragPipeline` /
  `rag_pipeline`, `analyticsCube` / `analytics_cube`) as separate
  entries even though they map to the same type. A new
  `dedupeRegistryEntries` collapses each alias pair, sums the
  counts, and keeps the canonical camelCase name for display.
- Drop the "+ N empty types" footnote — pure dev jargon.
- Replace the opaque `/api/v1   REST · data · meta · packages`
  stat card with a clearer "REST API — Live" card that links to
  the APIs page.

**Forms**:

- Rewrite the page description from a wall of
  `FormView` / `sharing.allowAnonymous` / `GET /api/v1/forms/:slug`
  jargon to plain English: "Forms anyone can fill out — no login
  required. Publish a form to get a shareable link; submissions
  land directly in the bound object."
- Empty state now points users at the visible action button
  instead of telling them to "Declare a FormView with
  `sharing.allowAnonymous: true`".

**Logs**:

- Empty states no longer leak the internal endpoint paths
  (`Awaiting /api/v1/_debug/requests.`) — they just say
  "Coming soon. Requests will stream here in real time."
