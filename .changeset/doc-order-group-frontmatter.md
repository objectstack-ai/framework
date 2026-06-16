---
"@objectstack/cli": patch
---

fix(build): collect per-doc `order:` and `group:` frontmatter so book sorting/placement works

The doc collector (`collectDocsFromSrc`) parsed only `title:`/`description:` from
each `src/docs/*.md` frontmatter, so the `order` and `group` fields defined on the
`Doc` schema (ADR-0046 §6) were never populated on the compiled `doc` item. The
book resolver (`resolveBookTree`) already sorts group members by `doc.order` then
label and honors explicit `doc.group` placement — but with the collection half
silently dropping both fields, frontmatter-driven sorting/placement never reached
the artifact.

`parseFrontmatter` now also reads `order:` (parsed to a number; ignored when
non-numeric) and `group:` (string), threading them onto the collected doc when
present. Absent leaves both undefined so the schema/resolver defaults apply. Also
corrects the `order` JSDoc in `doc.zod.ts` to match the resolver, which treats an
absent `order` as `0` (not "after ordered siblings").
