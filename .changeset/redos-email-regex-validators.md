---
"@objectstack/objectql": patch
"@objectstack/plugin-email": patch
---

fix(validation): remove polynomial ReDoS in email validation regexes

The email validators used `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, whose quantifiers
around `\.` overlap (the literal dot is also matched by `[^\s@]`) and backtrack
polynomially on adversarial input. The domain part is rewritten as
`[^\s@.]+(?:\.[^\s@.]+)+` so labels exclude `.` and matching is linear. Valid
addresses (including multi-label domains) are unaffected; addresses with an
empty label such as `a@b..c` are now correctly rejected.
