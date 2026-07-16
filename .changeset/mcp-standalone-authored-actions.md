---
'@objectstack/runtime': patch
---

Surface standalone authored `action` metadata rows on the MCP action bridge (#3010). `list_actions` and `run_action` now resolve declarations from `object.actions` unioned with standalone `action` items, keyed the same way the engine registers their handlers (`objectName` → legacy `object` → `'global'`), with object-embedded declarations winning on a key clash. Previously a Studio-authored standalone action executed via REST but was invisible and uninvokable on the MCP/AI surface, even with `ai.exposed: true`. All invoke-time gates (`ai.exposed` fail-closed, ADR-0066 D4 capability gate, sys_* fail-closed) are unchanged.
