---
"@objectstack/spec": patch
---

Add `*Input` authoring-type aliases (`DatasourceInput`, `ConnectorInput`, `SharingRuleInput`, `JobInput`, `WebhookInput`, `EmailTemplateDefinitionInput`, `RoleInput`, `PermissionSetInput`, `ObjectExtensionInput`) alongside the existing `FieldInput`/`ActionInput`/`ReportInput`/`PortalInput` convention. These are `z.input<typeof XSchema>` aliases so authored literals keep `.default()` fields optional and accept CEL/Expression string shorthands — matching how `defineX()` helpers already accept input. No runtime change.
