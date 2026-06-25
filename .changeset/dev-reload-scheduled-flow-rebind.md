---
"@objectstack/service-automation": patch
"@objectstack/metadata": patch
---

fix(automation): re-bind scheduled-flow jobs on `os dev` hot-reload

Editing a schedule-triggered flow under `objectstack dev` silently kept firing
the OLD definition until a full server restart. The dev watcher recompiles
`dist/objectstack.json` and MetadataPlugin reloads it into the MetadataManager
(so GET /meta reads + UI HMR are fresh), but the AutomationEngine pulls its flow
definitions and trigger/job bindings ONCE at boot — nothing re-registered them
on reload. So the scheduled job bound at boot kept running the pre-edit flow
(old `runAs`, schedule, or logic) on its timer, with no signal that the edit had
no effect.

Fix: MetadataPlugin now fires a generic `metadata:reloaded` hook after each
artifact reload (the HMR POST handler and the server-side artifact-file watcher;
never on the initial boot load). AutomationServicePlugin subscribes and re-syncs
the engine from the metadata service — re-registering every current flow
(idempotent: `registerFlow` re-binds the trigger, and `ScheduleTrigger.start`
cancels + reschedules the job) and unregistering flows removed from the artifact
so their jobs stop firing. This covers all auto-triggered flow types
(schedule / record-change / api), not just scheduled ones, since record-change
flows were also executing their boot-time definitions after an edit. Production
deployments are unaffected — nothing reloads the artifact there.
