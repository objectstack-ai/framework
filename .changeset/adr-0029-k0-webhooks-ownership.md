---
"@objectstack/objectql": minor
"@objectstack/platform-objects": minor
"@objectstack/plugin-webhooks": minor
---

ADR-0029 K0 + K2.a — single-owner invariant and webhooks ownership pilot.

**K0 (`@objectstack/objectql`)** — add `SchemaRegistry.assertSingleOwnerPerObject()`,
the install-time backstop for the kernel-decomposition invariant: every
registered object must resolve to exactly one `own` contributor. A second
cross-package owner is already rejected at registration time; this additionally
catches "extend with no owner" (which would otherwise resolve to nothing). Call
after kernel bootstrap completes.

**K2.a (`@objectstack/plugin-webhooks` ← `@objectstack/platform-objects`)** — move
the `sys_webhook` object definition out of the `platform-objects` monolith into
`@objectstack/plugin-webhooks`, where it joins its sibling `sys_webhook_delivery`
so the plugin owns both its data model and behavior as one unit. `sys_webhook` is
no longer exported from `@objectstack/platform-objects` (or its `/integration`
subpath, now an empty barrel); import it from `@objectstack/plugin-webhooks/schema`
instead. Runtime behavior is unchanged — the webhook plugin already registered
`sys_webhook` at runtime; only the definition's home moved. Setup-app navigation
(which references `sys_webhook` by name) and existing i18n bundles (object-name
keyed) continue to work. Per ADR-0029 D8, migrating the object's i18n extraction
into the plugin is a tracked follow-up before the next translation regeneration.
