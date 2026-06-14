# @objectstack/setup

## 9.4.0

### Minor Changes

- 593d43b: feat(apps): extract Setup into its own `@objectstack/setup` app package (ADR-0048)

  ADR-0048 "one app per package": Setup gets a distinct package id
  (`com.objectstack.setup`) and namespace (`setup`), carrying both `SETUP_APP` and
  its baseline `SETUP_NAV_CONTRIBUTIONS`, so `/apps/<packageId>` resolves
  unambiguously. Boot-neutral skeleton (transitional import from platform-objects;
  not yet wired into the dev/serve plugin set — that switch lands in a follow-up
  verified against a live `os dev` boot).

### Patch Changes

- Updated dependencies [060467a]
- Updated dependencies [0856476]
- Updated dependencies [b678d8c]
- Updated dependencies [b678d8c]
- Updated dependencies [b678d8c]
  - @objectstack/spec@9.4.0
  - @objectstack/platform-objects@9.4.0
