---
"@objectstack/core": patch
---

chore(license): unify the framework repo to a single Apache-2.0 license

The repo was left in a half-finished, self-contradictory source-available
transition: 44 package `LICENSE` files carried restrictive dual-license text
(a Licensor of "ObjectStack AI LLC", a four-year conversion date, and an
anti-competitive-hosting grant) while those same packages' `package.json`
already declared `"license": "Apache-2.0"` — and that license text pointed at
`LICENSING.md` for the authoritative list of restricted packages, which listed
none. The root also carried a redundant `LICENSE.apache` left over from that
transition.

The framework is deliberately permissive Apache-2.0 to maximize adoption; value
capture lives in the separate closed-source cloud repo, not here. This change
makes that unambiguous: every package `LICENSE` now contains the canonical
Apache 2.0 text (copied from the root `LICENSE`), the redundant root
`LICENSE.apache` is removed, and `LICENSING.md` states the entire repository is
Apache-2.0 with no dual-license language. No restrictive-license residue remains
anywhere outside `node_modules`.

This is a metadata-only change (license text and `package.json` already agreed);
the patch bump republishes the affected packages with the corrected `LICENSE`.
