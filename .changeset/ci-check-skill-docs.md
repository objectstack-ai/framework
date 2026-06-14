---
---

ci: add a `Check Skill Docs` job that runs `check:skill-docs` on PRs touching
`skills/**`, the skills guide, or the generator — failing if the generated
README/guide listings drift from the `SKILL.md` frontmatter. CI-only, no
package change.
