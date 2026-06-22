---
"@objectstack/runtime": patch
---

refactor(runtime): build the standalone default driver via the shared datasource factory (ADR-0062 follow-up)

`createStandaloneStack` now constructs its `default` driver for the user-facing
kinds (memory / better-sqlite3 / postgres / mongodb) through the **same**
`createDefaultDatasourceDriverFactory` used for declared and runtime-admin
datasources — one "driver kind → instance" construction path instead of two
hand-mirrored ones. Adding a dialect or changing connection/pool defaults now
happens in a single place. URL→config translation, filesystem prep (`mkdir`),
and pre-engine `DriverPlugin` registration stay in the stack (unchanged); the
factory only constructs the driver. The pure-JS WASM sqlite driver stays bespoke
in the stack — it's the standalone-specific, CI-safe default and not a
user-creatable datasource type, so it has a single construction site already.

No behavior change: the same driver instances are built for the same inputs
(verified by a per-kind connect + CRUD round-trip test and a real `os dev` boot).
Adds `@objectstack/service-datasource` as a runtime dependency (no cycle — that
package depends only on core/spec).
