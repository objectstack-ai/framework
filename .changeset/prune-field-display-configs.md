---
"@objectstack/spec": minor
---

chore(spec): prune 15 dead field display-config properties (ADR-0049 / dead-surface plan). Removes `FieldSchema` enhanced-type *display* knobs that had no runtime reader and no renderer consumer (dead in both layers per the field liveness audit): code `theme`/`lineNumbers`, rating `allowHalf`, location `displayMap`/`allowGeocoding`, address `addressFormat`, color `colorFormat`/`allowAlpha`/`presetColors`, slider `showValue`/`marks`, barcode/qr `barcodeFormat`/`qrErrorCorrection`/`displayValue`/`allowScanning`. The wired knobs (`language`, `maxRating`, `step`) and the functional nested configs (`currencyConfig`/`vectorConfig`/`fileAttachmentConfig`) are kept. Field *types* are unchanged; only unused optional config props are removed. Narrows the false spec surface (narrow-and-true).
