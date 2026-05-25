---
'@objectstack/cli': minor
---

Include `ai` in the `default` tier preset so `AIServicePlugin` is auto-registered for every stack that opts into the default tier (i.e. any `defineStack` that doesn't override `requires`). Previously AI routes (`/api/v1/ai/*`) only mounted when a stack explicitly listed `'ai'` in `requires` or ran the `full` preset; now they're on by default, matching `i18n`/`ui`/`auth`. The auto-registration block already fails silently if `@objectstack/service-ai` isn't installed, so apps without the package are unaffected.
