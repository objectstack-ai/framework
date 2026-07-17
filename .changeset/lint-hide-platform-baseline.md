---
"@objectstack/cli": patch
---

`os lint` no longer buries the user's own signal under the platform i18n baseline. A fresh scaffold reported 800+ `i18n/missing-metadataForm` errors — translation keys for platform built-in metadata forms (email_template, …) that the platform packages already ship at runtime. Those are now hidden by default and folded into one summary line (`platform built-ins: N i18n issue(s) hidden`); pass `--include-platform` to audit them, and read `hiddenPlatform` in `--json` output. User-authored metadata coverage is reported unchanged.
