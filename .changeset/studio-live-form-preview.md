---
'@objectstack/studio': patch
---

Studio: wire form previews to the **real running backend** instead of the
hand-rolled disabled-input mockup.

- New `LiveFormPreview` component renders `<ObjectForm>` from `@object-ui/plugin-form`
  against the live `DataSource`, with a Create / Edit / Read-only mode toggle and a
  record picker (top 10 most-recent records via `dataSource.find`) for Edit mode.
- New `LivePreviewStatusBar` footer surfaces a pulsing **LIVE** indicator with
  the backend base URL and bound object so it is obvious previews are real, not
  mocked.
- Playground "Form preview" tab now uses `LiveFormPreview` and correctly unwraps
  the `{ type, items }` envelope returned by `client.meta.getItems('view')`
  (previously the `.map` call silently threw, leaving the tab showing
  "No forms yet" even when ten forms existed).
- `MetadataPreview` routes both single-spec form views and multi-view docs
  through `LiveFormPreview`; non-form previews now show the LIVE status bar.
- Object detail page Forms/Views tabs now also detect multi-view documents
  (where `object` is nested under `list.data.object` / `form.data.object`).
- Removed legacy mock `FormPreview` component.
