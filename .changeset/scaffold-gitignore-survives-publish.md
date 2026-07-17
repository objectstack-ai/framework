---
"create-objectstack": patch
---

Scaffolded projects ship with a `.gitignore` again — `npx create-objectstack` produced none, leaving `node_modules/` and `.env` un-ignored for every new user.

`npm pack` / `pnpm pack` strip `.gitignore` from a tarball unconditionally, at every depth. The blank template committed one at `src/templates/blank/.gitignore` and the build faithfully copied it to `dist/templates/blank/.gitignore`, but `files: ["dist"]` publishing dropped it on the way to the registry — so the file was present in the repo, present in every local build, and absent from all 11 files of a real scaffold. Verified against the published 15.1.1 tarball, which ships `dist/templates/blank/.dockerignore` and no `.gitignore`.

The template is now committed as `_gitignore` (a name npm does not strip) and restored to `.gitignore` when the template is copied, via a `TEMPLATE_FILE_ALIASES` map in the new `template-copy.ts`. Only `.gitignore` is aliased: the strip list is `.gitignore` and `.npmrc`, not "every dotfile" — `.dockerignore` packs fine and stays literal.

The restored ignore rules also cover `.env` / `.env.*`, which they never did. The template README has users write `OS_AUTH_SECRET` and `OS_SECRET_KEY` into a `.env`, and `docker-compose.yml` calls that file "never committed" — but only the prose said so, and `.dockerignore` was the only file that listed it.

A packing ratchet in `template-consistency.test.ts` guards both halves: it packs the real package, scaffolds from the extracted tarball with the real copy logic, and asserts every template file lands under its intended name. Source-level assertions cannot see this class of bug — the file only vanishes at publish.
