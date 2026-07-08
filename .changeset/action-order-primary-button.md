---
"@objectstack/spec": minor
---

`Action`: add an explicit `order` field so authors and plugins can decide which action holds the record-header primary-button slot, instead of depending on fragile cross-file `defineStack({ actions })` registration order (#2670).

`order` is an optional number, **lower = higher / more prominent**, defaulting to `0`. `mergeActionsIntoObjects()` now stable-sorts every action group — each object's `actions` and the top-level `actions` — by `order` at both `defineStack()` and `composeStacks()` time. In `record_header` the first visible action becomes the primary button, so a negative `order` promotes an action into the primary slot and a positive `order` demotes it toward the `⋯` overflow menu. This is the declarative lever a plugin such as plugin-approvals uses to make an `Approve`/`Reject` decision stably outrank app actions, rather than hiding the other actions to "make room".

Fully backward compatible: the sort is stable and treats unset `order` as `0`, so action groups where nobody sets `order` keep their exact registration order (and array reference). The record-header renderer (objectui) may additionally prefer a `variant: 'primary'` action when two actions tie on `order`.
