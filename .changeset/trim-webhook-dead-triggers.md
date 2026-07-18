---
"@objectstack/spec": patch
"@objectstack/plugin-webhooks": patch
---

Trim the dead `undelete` and `api` webhook triggers (#3196). `WebhookTriggerType` declared five triggers but only three ever fired:

- `undelete` had no event source — the engine has no soft-delete/restore capability (`delete` is a hard delete; no `deleted_at` convention, no restore operation, and `data.record.undeleted` is never emitted). The `undeleted` case in the auto-enqueuer's action mapper was dead code awaiting a producer that doesn't exist.
- `api` ("manually triggered") had no fire path — the only webhook HTTP surface re-queues already-failed deliveries; nothing originates a manual fire.

Both are removed from the enum (contract-first, matching #3184/#3195): authoring a webhook on a removed trigger now fails loudly at `os validate` / registration instead of registering a webhook that silently never fires. No shipped webhook metadata used either. The auto-enqueuer now also warns when a persisted `sys_webhook` row carries a trigger it can't map to an emitted record event (a drift-guard, so a dead trigger can't silently no-op again). Reintroduce `undelete` only alongside a real restore subsystem, and `api` only alongside a real manual-fire endpoint. Updated the `sys_webhook` trigger options, field help (all locales), docs, and reference; added rejection tests.
