---
'@objectstack/service-automation': minor
---

Flow `notify` node: support a click-through target so inbox notifications can be clicked into the related record (#2675).

The `notify` node now reads `sourceObject` / `sourceId` (or the nested `source: { object, id }` form) and `actorId` from its config and forwards them to the messaging service, which persists `sys_notification.source_object` / `source_id` / `actor_id` and synthesizes a `/{object}/{id}` inbox deep-link. Both keys interpolate flow variables (e.g. `sourceId: '{new_quotation.id}'`), and a half-specified target (object without id, or vice versa) is dropped so the inbox never renders a dead link. `url` is now accepted as an alias for `actionUrl` (an explicit URL still overrides the synthesized link). The node also publishes a `configSchema` documenting all accepted keys for the Studio form.

Previously the node consumed only `recipients` / `title` / `message` / `channels`, so every notification it emitted had `source_object` / `source_id` = `null` and could not be clicked through to a record.
