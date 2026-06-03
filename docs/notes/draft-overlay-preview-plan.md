# Draft-overlay preview — implementation plan

**Goal:** an admin flips a "preview drafts" switch and navigates the live console/app with
every surface (object pages, list/kanban/form views, app nav, dashboards) rendered off
**draft-overlaid** metadata — so AI/hand-authored changes can be *seen rendered* before publish,
not just read as a JSON diff.

**Unifying insight:** the same "draft-overlay read mode" serves BOTH
- the human (preview mode renders drafts), and
- the AI agent (`list_metadata` can see its own just-drafted objects — the Fix-2 gap that made
  multi-step "build app → build flow" break because the flow step couldn't find draft objects).

One foundation, two payoffs. Drafts become a first-class **renderable** state.

## Hard limit (be honest)
Brand-new draft objects have **no physical table until publish** (`ensureObjectStorage` runs on
`publishMetaItem`). So preview of a *new* object shows **shape** (form layout, view columns, kanban
groupBy, nav) but **no data / can't create records**. Field-additions to *existing* objects preview
fully. Full data-preview for new objects needs draft-tables / a preview environment (`sys_metadata`
already has `environment_id`) — deferred (ties to ADR-0027).

## PRs

### PR1 — backend draft-overlay foundation (framework)  ← THIS PR
- `getMetaItems(request + previewDrafts?)`: after the active overlay, if `previewDrafts`, query
  `state='draft'` rows (env-wide + org) and overlay them on top (draft WINS over active; draft-only
  items appear). Mark each `_draft: true`. (protocol.ts ~1175-1234)
- `getMetaItem(request + previewDrafts?)`: non-strict — draft if it exists, else fall back to active
  (distinct from the existing strict `state:'draft'` which 404s). Mark `_draft: true`. (~1337)
- Dispatcher `handleMetadata`: read `?preview=draft`, thread `previewDrafts` into both list + detail
  reads. (http-dispatcher.ts ~947, ~1004)
- Tests (protocol): draft overlays active; draft-only surfaces; `_draft` flag; getMetaItem fallback.
- Changeset (objectql minor, runtime patch).
- **No admin gate yet** — deferred to PR3 per product call (step 2).

### PR1.5 — graceful no-table data path
When `preview=draft` and a draft-only object has no table, the DATA query returns empty + a
`draftNoTable` signal instead of "no such table". (data dispatcher)

### PR2 — objectui frontend (sibling repo)
- Admin-only "Preview drafts" toggle in the app shell; persistent "PREVIEW — drafts" banner.
- Metadata client threads `?preview=draft` on all metadata reads when the toggle is on.
- `_draft` badge on overlaid items; tolerate empty draft-object lists.

### PR3 — admin gating (the user's explicit "step 2")
Gate `preview=draft` to platform/org admins (reuse `isPlatformAdmin()`/`isActiveOrgAdmin()` from
plugin-auth auth-manager.ts:961-1005). Non-admin flag → silently serve active (never leak drafts).

### PR4 — AI discovery reuse (Fix 2)
Point the AI `list_metadata`/`describe_metadata` tools at the same draft-overlay read so the agent
can reference its own drafts; thread `packageId` into `create_metadata` so AI-authored flows bind to
the app package (the orphan-flow bug found in verification).
