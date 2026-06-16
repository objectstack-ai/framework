---
---

chore(spec): govern the `ai` category (Agent/Tool/Skill) in the spec-liveness gate, and add two gate capabilities: an **allowlist mode** (`"mode":"allowlist"`) so categories dominated by protocol/engine DTOs only classify their authorable subset, and **auto-classification of ADR-0010 framework provenance/lock fields** (`_lock*`/`_provenance`/`_packageId`/`protection`). Seeded from the agent/tool/skill liveness audits. Repo-internal tooling; no package version impact.
