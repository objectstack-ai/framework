---
"@objectstack/spec": patch
---

ui(page.form): icon field uses the searchable icon-picker widget

The Basics → `icon` field now carries `widget: 'icon'`, so the metadata-admin
form renders a searchable Lucide icon picker (preview + name) instead of a raw
text input where authors had to type an exact icon name. Mirrors the existing
`view-ref` / `filter-mode` widget hints; the picker ships in
`@object-ui/app-shell` and is reusable for app/object icon fields.
