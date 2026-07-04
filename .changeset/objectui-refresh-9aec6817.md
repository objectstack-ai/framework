---
"@objectstack/console": minor
---

chore(console): refresh vendored `@object-ui/console` SPA to objectui@9aec6817

Bumps the pinned `.objectui-sha` from `144ab55b` to `9aec6817` (13 commits) and rebuilds the prebuilt Console SPA shipped in `@objectstack/console`.

Notable upstream changes pulled in:

- feat(studio): Data pillar Validations + Settings views (builder-ui Phase B)
- feat(studio): package switcher + inline new-writable-package in the top bar
- feat(home,studio): builder cover on Home + builder→app bridge; builder landing joins the login journey
- fix(app-shell): stop double-toasting failed script/modal action errors; don't show recovery-password reminder on SSO-enforced envs or first landing
- fix(plugin-grid): keep row selection in sync when bulk-action dialog closes; i18n the bulk-action dialog; readable import preview
- fix(form): de-emphasize field labels so fieldGroups hierarchy reads
