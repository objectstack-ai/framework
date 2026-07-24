---
"@objectstack/plugin-approvals": patch
---

fix(plugin-approvals): give the decision actions a visual hierarchy (objectui#2762 P1-5)

The `sys_approval_request` decision actions all declared as equal-weight
buttons, so the drawer's action bar rendered five identical outlined
buttons with no emphasis on the primary path. `approval_approve` now
declares `variant: 'primary'` and `approval_reject` declares
`variant: 'danger'`, so a metadata-driven renderer highlights Approve and
styles Reject as destructive — matching the hierarchy the mobile card
already has. Pure metadata; the secondary levers stay unstyled (tertiary).
