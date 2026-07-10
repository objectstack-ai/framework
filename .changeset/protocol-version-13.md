---
'@objectstack/spec': patch
---

fix(spec): bump `PROTOCOL_VERSION` to 13.0.0 — restore lockstep with the package major

The ADR-0090 P1 breaking wave took the platform to 13.0.0, but the protocol
constant (the value the `engines.protocol` handshake compares) stayed at
12.0.0, tripping the lockstep guard in `protocol-version.test.ts` and turning
`Test Core` red on main for every PR. Protocol 13 is semantically correct:
the P1 renames (`roles:` → `positions:`, kind `role`/`profile` → `position`,
no aliases) are exactly the kind of authorable-surface break the handshake
exists to refuse across majors.
