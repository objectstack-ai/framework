---
"create-objectstack": patch
---

Stop leaking repo-internal skills into scaffolded projects. The scaffolder (and the docs) advertised `npx skills add objectstack-ai/framework --all`, and the skills CLI's `--all` implies `--skill '*'` — which includes even `metadata.internal` skills — so repo-internal tooling like `.claude/skills/dogfood-verification` landed in every new project's `.agents/skills/`. All install commands are now scoped to the published catalog via the `/skills` subpath (`npx skills add objectstack-ai/framework/skills --all`), the internal skill is additionally marked `metadata.internal: true` to hide it from interactive discovery, and a template-consistency ratchet plus a scaffold-e2e assertion keep the boundary from regressing.
