---
'@objectstack/spec': patch
'@objectstack/cli': patch
---

chore(liveness): authorWarn sweep across all governed types + lint coverage to match

Every remaining *misleading* dead property now warns at compile time (12 new
markings): `flow.errorHandling.fallbackNodeId` (engine uses fault edges),
`flow.nodes[].outputSchema` (never validated), `flow.template`,
`action.timeout` (no runtime enforcement), `object.tenancy.strategy` /
`crossTenantAccess` (only enabled+tenantField are read), `object.abstract`,
`field.dependencies`, `agent.tenantId`, `tool.permissions` (invocation not
permission-gated), `permission.contextVariables` (RLS reads current_user.*
only), `dataset.measures[].certified` (governance flag unenforced).

The compile-time lint previously only checked objects+fields, so markings on
other types were silent — it now covers every governed type (flat stack
collections) and fans container checks out over arrays (one finding per
item+path). Benign display metadata (label/description/tags) stays unmarked
per the README's signal rules.

Also re-anchors the README: the counts table had drifted badly (field listed
as 34 live/39 dead vs the ledger's actual 54/6; `action.disabled` was still
described as ignored though it went live via metadata-admin) — replaced with
regenerable numbers plus the script to regenerate them, and added the
cross-repo evidence rule (grep ../objectui before classifying dead — the
enable.trackHistory lesson, #2707).
