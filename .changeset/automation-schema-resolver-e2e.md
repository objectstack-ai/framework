---
"@objectstack/service-automation": patch
---

test(automation): end-to-end coverage for the #1928 object-schema resolver wiring

Adds a kernel-level integration test proving `AutomationServicePlugin` bridges
the engine's object-schema resolver to the live `objectql.registry.getObject` at
`start()` (fields + types resolved from the registry), and that a flow
registered through the running kernel with a text field misused in arithmetic
emits the tier-4 advisory — while a sound condition stays quiet. Locks in the
production integration point that the engine-level unit tests (which set the
resolver by hand) could not exercise. Test-only; no behavior change.
