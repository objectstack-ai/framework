---
---

chore(spec): add a spec liveness gate — every authorable property in a governed category must declare a runtime-liveness status (live/experimental/planned/dead) with evidence in `packages/spec/liveness/<category>.json`, enforced by CI on PRs touching `packages/spec/**`. Seeds the `security` category from the liveness audit (93 props: 66 dead, 26 live, 1 experimental); the dead set is the worklist for the security enforce-or-remove ADR. Repo-internal tooling; no package version impact.
