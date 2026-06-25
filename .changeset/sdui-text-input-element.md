---
'@objectstack/spec': minor
---

feat(ui): add `element:text_input` — free-text data-entry element for SDUI pages

SDUI pages could display and navigate but not collect free-text input. This adds
that half of the contract:

- `ElementTextInputPropsSchema` (label, placeholder, `inputType` —
  text/email/number/tel/url/password — defaultValue, required, disabled,
  description) wired into `PageComponentType` and `ComponentPropsMap` as
  `element:text_input`.

The objectui renderer binds the typed value into a page variable
(`PageVariableSchema.source`); a submit `element:button` reads it back via
`{{page.<var>}}` token interpolation in the console action runtime. Showcase:
`showcase_contact_form` (text inputs → page variables → POST web-to-lead).
