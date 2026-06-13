---
"@objectstack/setup": minor
---

feat(apps): extract Setup into its own `@objectstack/setup` app package (ADR-0048)

ADR-0048 "one app per package": Setup gets a distinct package id
(`com.objectstack.setup`) and namespace (`setup`), carrying both `SETUP_APP` and
its baseline `SETUP_NAV_CONTRIBUTIONS`, so `/apps/<packageId>` resolves
unambiguously. Boot-neutral skeleton (transitional import from platform-objects;
not yet wired into the dev/serve plugin set — that switch lands in a follow-up
verified against a live `os dev` boot).
