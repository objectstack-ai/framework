---
"@objectstack/service-sms": patch
"@objectstack/cli": patch
---

refactor(sms): rename `@objectstack/plugin-sms` to `@objectstack/service-sms`

Infrastructure services follow the `service-*` convention
(`service-messaging`, `service-settings`, …) — the `plugin-*` prefix was a
misfit for a package whose whole job is registering the `sms` kernel
service (`plugin-email` is legacy debt, not precedent). Same exports, same
`SmsServicePlugin` class, same `sms` service id and settings namespace —
only the package name and its home (`packages/services/service-sms`)
change. The one published `@objectstack/plugin-sms@14.3.0` release should
be npm-deprecated in favour of `@objectstack/service-sms`.
