---
"@objectstack/plugin-security": patch
"@objectstack/platform-objects": patch
---

Setup → Access Control nav: the `sys_position` entry is renamed
`nav_roles`/"Roles" → `nav_positions`/"Positions" (岗位 / ポジション /
Posiciones) — the last "role" leftover in platform UI copy (ADR-0090 D3;
the Studio-side relabel already landed in objectui). The framework's
`.objectui-sha` pin is bumped to pick up the Studio Access-pillar explain
panel ("why can this user access?", ADR-0090 D6) and the suggested
audience-binding install prompt (D5/D9).
