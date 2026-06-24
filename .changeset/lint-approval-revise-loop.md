---
'@objectstack/cli': patch
---

feat(cli): lint ADR-0044 approval revise-loop footguns at compile time

`objectstack compile` now warns on two send-back-for-revision shapes an AI (or human) authoring an approval flow commonly gets wrong:

- **Dead-end revise** — an approval node with a `revise` out-edge but no path looping back to it. This is a valid DAG, so `registerFlow` accepts it, yet the submitter reworks the record with nowhere to resubmit. The linter is the only place that catches the dead end.
- **Un-declared revise loop** — the loop returns to the approval but the closing edge isn't `type: 'back'`, so `registerFlow` rejects it as an un-declared cycle. The lint fires at compile time with the specific fix (mark the resubmit edge `type: 'back'`).

Also flags `maxRevisions: 0` alongside a `revise` edge (send-back disabled, so the branch always auto-rejects and never runs). Advisory only — never fails the build. Part of #2274 / ADR-0044.
