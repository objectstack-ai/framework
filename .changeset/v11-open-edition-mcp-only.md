---
"@objectstack/spec": major
---

Open edition is MCP-only.

The bundled AI authoring service (`@objectstack/service-ai`) is no longer part of
the open distribution (ADR-0025 S2, #2325); AI now integrates through MCP
(`@objectstack/mcp`) and the documented opt-in seam — an app that declares
`@objectstack/service-ai` / `@objectstack/service-ai-studio` still loads the
service. Removing a published package from the open edition is a breaking change,
so this cuts the next release as a major.
