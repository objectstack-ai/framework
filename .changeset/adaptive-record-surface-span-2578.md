---
"@objectstack/spec": minor
"@objectstack/lint": minor
---

feat(spec,lint): adaptive record surface + semantic field `span` for field-heavy objects (#2578)

Field-heavy objects need two things the protocol did not express well: multi-column
forms, and opening create/edit/detail as a full page rather than a cramped popup —
for *some* objects, automatically. Because all metadata is AI-authored, the design
goal is to make AI unable to get it wrong, which reshaped both features away from
new authored keys.

**`deriveRecordSurface` (new spec derivation, ADR-0085 §5).** A record's default
surface — full `page` vs `drawer`/`modal` overlay — is *derived* from how heavy the
record is (visible, non-system field count; mobile always pages), not authored. Per
ADR-0085 §2's admission test a `recordSurface` object key would fail: field count is
exactly the kind of fact a machine can infer, and modal-vs-page is pure
re-arrangement, not a business fact. So there is **no new object key** and **no new
ADR** — just a single shared derivation renderers consume as a default (an explicit
form/navigation config still wins), plus a one-line clarification to ADR-0085 §2's
rejected-keys list so `recordSurface` is not re-proposed. Explicit per-object control
remains the sanctioned assigned-page path.

**`FormField.span: 'auto' | 'full'` (new, replaces absolute `colSpan` as the
primary primitive).** Under a per-surface derived column count (mobile 1 / modal 2 /
page 3-4) an absolute `colSpan: 3` only lines up at the one width the author
imagined — fragile by construction. The relative `span` is decoupled from the column
count: `auto` (default; omit it) sizes by widget type × current columns, `full` takes
the whole row at any count. `colSpan` is retained for back-compat and clamped by the
renderer; `half` was considered and deferred (weakest AI-safety). The rationale lives
here rather than in a new ADR, per the fewer-ADRs convention.

**`validateFormLayout` (new lint, ADR-0078/0019).** Two advisory rules over authored
form views: `form-field-unknown` (a section references a field not on the bound
object — silently never renders) and `absolute-colspan-discouraged` (steers authors
to `span: 'full'`). Both warnings, with fix hints, held to the same bar for AI and
hand authors.

**`NavigationConfig.size` (new) replaces pixel `width`.** A T-shirt bucket
(`auto`/sm/md/lg/xl/full, default `auto`, aligned with `FormView.modalSize`) for a
drawer/modal detail overlay. `width`/`drawerWidth` (pixel) are deprecated: a pixel
width cannot be authored blind — the author (often an AI) does not know the client
viewport. `auto` means the renderer derives the size from field count and clamps to
the viewport, so AI writes nothing.

All additive: no exports removed, no behavior change for existing metadata.
