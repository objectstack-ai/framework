---
"@objectstack/plugin-webhooks": minor
---

Webhook form: pick, don't type. The `sys_webhook` create/edit form made admins
hand-type machine data in three fields; they're now proper controls (extends the
`sys_sharing_rule` pass):

- `method` — free text → **select** (`GET`/`POST`/`PUT`/`PATCH`/`DELETE`). Option
  values are lowercased by `Field.select`; the auto-enqueuer now upper-cases the
  resolved method before delivery, so legacy `'POST'` rows and the new lowercase
  values both normalise to a canonical HTTP method.
- `triggers` — hand-typed comma-separated string → **multi-select**
  (`create`/`update`/`delete`/`undelete`/`api`). Stored as an array; the
  auto-enqueuer's `parseRow` now accepts array, JSON-encoded-array-string, and
  the legacy comma-separated forms, so existing subscriptions keep firing.
- `object_name` — free text → the **`object-ref`** object picker (same widget as
  `sys_sharing_rule`; degrades to a text input where the widget isn't loaded).

Backward compatible: no data migration required. Added tests covering the array
and JSON-string trigger shapes.
