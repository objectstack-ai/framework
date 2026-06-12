---
"@objectstack/spec": minor
"@objectstack/cli": minor
"@objectstack/objectql": minor
"@objectstack/runtime": patch
---

ADR-0046 P1: package documentation as metadata. New `doc` metadata element — flat Markdown files under `src/docs/*.md` compile into `docs: DocSchema[]` on the stack and register like any other metadata.

- spec: `DocSchema` ({ name, label?, content }) in `system/`, `StackDefinition.docs`, `doc` in `MetadataTypeSchema` + type registry (inert data, runtime-creatable) + canonical schema map, `docs → doc` plural mapping.
- cli: `os build` collects flat `src/docs/*.md` (frontmatter `title:`/first `#` heading → label) and enforces the ADR lint — flat directory, namespace-prefixed snake_case names, namespace required when docs ship, MDX/image ban, same-package relative-link resolution. Same rules surface in `os lint`.
- objectql: `docs` joins the generic metadata registration loop (manifest + nested plugins).
- runtime: docs count as app payload; `GET /metadata/doc` list responses omit `content` by default (`?include=content` opts in) so unbounded manuals stay off hot paths.
