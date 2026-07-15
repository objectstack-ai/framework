---
'@objectstack/plugin-reports': patch
'@objectstack/service-knowledge': patch
'@objectstack/plugin-sharing': patch
---

fix(security): close three execution-surface authz holes surfaced by the #2849 class sweep (#2980, #2981, #2982)

Three independent, confirmed-exploitable defects where an execution surface
ignored the caller's identity or fell open on a missing one. Each is fixed at
its own enforcement point; none change behaviour for correctly-scoped callers.

- **#2980 — reports IDOR + scheduled-report RLS bypass.** `ReportService`
  discarded the caller's context and read/wrote `sys_saved_report` with a system
  context, so any authenticated user could read, delete, or overwrite any saved
  report by id (cross-owner / cross-tenant), and `listReports` enumerated all
  owners. `getReport`/`deleteReport`/`saveReport`/`listReports` are now
  owner-scoped (system read of the protection-locked metadata object, but
  authorization enforced by owner match); create/overwrite can no longer spoof
  ownership. Scheduled dispatch no longer runs `isSystem` (which emailed the
  target object's entire table past the owner's RLS): it resolves the owner to a
  real RLS-bearing context via a new `resolveOwnerContext` seam and **fails
  closed** (skips + marks the schedule failed) when the owner can't be resolved,
  rather than running elevated. Wiring that resolver is the reports-surface
  consumer of ADR-0073's user-less identity resolution.

- **#2981 — knowledge/RAG retrieval fall-open.** `applyPermissionFilter` returned
  every hit when the context was missing *or* system. A missing identity is no
  longer treated as a grant: object-backed hits fail closed (dropped, keeping
  ACL-less file/http hits), and only an **explicit** system context passes
  through. Closes the agent path where an omitted `ToolExecutionContext.actor`
  yielded unfiltered semantic search over the whole corpus.

- **#2982 — bulk-write OWD gap.** `update({multi:true})` / `deleteMany` had no
  single id to `canEdit`-gate, so owner scoping was skipped on private (and
  public_read) objects. A new `SharingService.buildWriteFilter` (the edit-set
  analogue of `buildReadFilter`) is AND-ed into the write AST for multi writes,
  constraining them to rows the caller may edit — including the on-behalf-of
  delegator intersection.

Tracked as the motivating evidence of ADR-0096 (execution-surface identity
admission); the mechanism that would prevent the class structurally is separate.
