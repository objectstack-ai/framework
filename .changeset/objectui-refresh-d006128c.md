---
"@objectstack/console": minor
---

chore(console): refresh vendored `@object-ui/console` SPA to objectui@d006128c

Bumps the pinned `.objectui-sha` from `46a12ef9` to `d006128c` (6 commits) and rebuilds the prebuilt Console SPA shipped in `@objectstack/console`.

Notable upstream changes pulled in:

- feat(detail): wire object fieldGroups into detail sections; read hints from spec-writable `detail.*` block
- fix(form): render object fieldGroups in create/edit modal; auto-layout parity for grouped ObjectForm
- fix(grid): refresh list after a bulk/row action succeeds
- fix(grid): inline-edit toggle takes effect immediately + staged editor closes on save
- fix(components): keep dialog/drawer open when a click closes an open dropdown
