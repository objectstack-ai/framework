---
"@objectstack/formula": patch
"@objectstack/cli": patch
---

feat(validate): advisory did-you-mean warnings for likely field typos in flow conditions

Adds a non-blocking warning channel to build-time expression validation (#1928
tier 3). Flow / automation conditions flatten the record's fields to top-level,
so a bare `status` is correct — but a bare NON-field identifier is either a flow
variable or a typo. When it is a near-miss of a known field (edit distance), the
build now emits a `did you mean \`status\`?` warning instead of staying silent,
WITHOUT failing the build (a genuine flow variable won't be close to a field
name, so it stays quiet). `ExprValidationResult` gains a `warnings` array and
`ExprIssue` a `severity`; `objectstack compile` prints warnings and only fails on
errors. This closes the silent-skip gap for misspelled trigger-condition fields
(the #1877 family) without the false-positive risk of a hard gate.
