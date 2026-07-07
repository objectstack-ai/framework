---
'@objectstack/service-settings': minor
---

Localization: drop the hard-coded `USD` platform default for the workspace **Default currency** setting.

Previously the `localization.currency` setting defaulted to `'USD'`, and that value was applied to any `currency`-typed field that omits its own code — so every code-less amount surfaced a `$`/`US$` symbol even when nothing (field, measure, or workspace) actually named a currency. The setting now has **no platform default**: a code-less currency amount renders as a plain number unless the workspace explicitly picks a default currency (or the field declares its own).

Migration: a workspace that relied on the implicit USD default and wants to keep showing `$` should set **Settings → Localization → Default currency** to `USD` explicitly. Fields/measures that declare their own currency code are unaffected.
