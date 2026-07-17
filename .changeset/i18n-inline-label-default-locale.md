---
"@objectstack/cli": patch
---

fix(cli): treat an inline `label:` as the default-locale source in i18n coverage

A fresh `npm create objectstack` scaffold reported 4 `i18n/missing-object` /
`i18n/missing-field` errors for its own `<ns>_note` object, even though the
template authors `label: 'Note'`, `pluralLabel: 'Notes'`, `label: 'Title'` and
`label: 'Body'` inline. The only way to silence them was to commit an `en`
bundle restating strings the metadata already carries.

The inline `label:` *is* the default-locale text: the runtime resolver falls
back to it when a bundle has no entry (`translateObject`), and `os i18n
extract` seeds bundles from it. Coverage now honours that contract — an inline
label satisfies the default locale, and a bundle is what *other* locales need.
Keys with no source string anywhere are no longer reported as i18n gaps; a
missing label is already `required/label`'s finding.

Non-default locales are unaffected: they still warn for every untranslated key
(`os lint` on `examples/app-todo` reports the same 79 warnings as before, with
its 39 default-locale errors gone). `os lint --include-platform` drops the
platform baseline's default-locale errors for the same reason — the platform
ships English labels inline — while keeping its non-default-locale warnings.
