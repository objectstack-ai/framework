---
'@objectstack/spec': minor
'@objectstack/platform-objects': minor
---

Add `Action.resultDialog` for one-shot reveal of API responses

Some platform operations return values the user MUST copy now because they
cannot be retrieved later — TOTP enrollment URIs, OAuth client secrets,
backup recovery codes. Previously these were handled by bespoke account-app
pages because actions only surfaced a `successMessage` toast.

This change adds:

- **`Action.resultDialog`** — describes a post-success modal that renders
  selected fields from `result.data`. Supports `qrcode`, `code-list`,
  `secret`, `text`, and `json` field formats. When set, renderers SHOULD
  suppress `successMessage` and require explicit acknowledgement.

- **`Action.target` interpolation contract** — formalised TSDoc spelling
  out the `${param.X}` and `${ctx.X}` substitution rules (with mandatory
  `encodeURIComponent` for URL query positions). Used by redirect-style
  actions like `link_social`.

New / updated platform actions:

- `sys_two_factor`: `enable_two_factor` now reveals TOTP URI + backup codes;
  added `regenerate_backup_codes`.
- `sys_oauth_application`: `rotate_client_secret` now reveals the new
  secret; added `create_oauth_application` toolbar action.
- `sys_account`: added `link_social` toolbar action (type:`url`, templated
  target) for self-service identity linking.

These let the Setup app cover OAuth-app registration, 2FA enrollment, and
social-account linking entirely through metadata, removing the last
must-have reasons to ship a separate `apps/account` SPA.

Renderer-side work (separate PR in `objectui`): consume `resultDialog`,
implement `${param}/${ctx}` interpolation, ship `ResultDialog` component.
See `c-tier-renderer-contract.md` design note.
