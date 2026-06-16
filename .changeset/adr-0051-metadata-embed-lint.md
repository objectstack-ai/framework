---
"@objectstack/cli": minor
---

feat(cli): lint `metadata` doc embeds (ADR-0051 P1) — validate every `metadata` fence body shape (type ∈ state_machine | flow | permission with did-you-mean, required name, object required for state_machine) and its same-package reference liveness (the referenced object + state_machine rule / flow / permission set must exist in the stack). A dead same-package reference is a build error, matching `docs/broken-link`.
