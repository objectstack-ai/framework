---
'@objectstack/plugin-auth': patch
'@objectstack/platform-objects': patch
---

fix(auth): align the better-auth family on 1.7.0-rc.1, implement the new adapter methods, and add the new sys_jwks columns (#2974)

Remediating GHSA-p2fr-6hmx-4528 (`@better-auth/oauth-provider`) requires the
1.7 plugin line, which imports `CLIENT_ASSERTION_TYPE` and other symbols that
only exist in `@better-auth/core` 1.7.x — so the whole better-auth family is
pinned to `1.7.0-rc.1` together (mixing a 1.7 plugin with 1.6.23 core 500s on
sign-in). better-auth 1.7 also extends its `CustomAdapter` contract with two
new methods, which the ObjectQL adapter now implements:

- `consumeOne` — atomic single-row consume (find the guarded row, delete it,
  return it), used by better-auth for single-use credential consumption
  (e.g. verification tokens on the sign-in path).
- `incrementOne` — guarded counter mutation (`field = field + delta` per
  `increment` entry plus any absolute `set` values), returning the updated row
  or `null` when the guard matches nothing.

Both are find-then-write mirrors of the existing `delete` / `update` methods
(ObjectQL exposes no native atomic primitive) and honour the same core/plugin
field-name bridging.

better-auth 1.7 also extends its `jwks` model with two new optional columns,
`alg` (signing algorithm, e.g. `EdDSA`) and `crv` (curve, e.g. `Ed25519`), and
writes them when minting signing keys. The `sys_jwks` platform object gains the
matching fields — without them every JWKS write failed (`table sys_jwks has no
column named alg`), 500ing token signing and breaking session validation
(sign-in succeeded but every authenticated request 401'd).
