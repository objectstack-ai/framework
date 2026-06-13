---
"@objectstack/cloud-connection": patch
---

install-local accepts compiled stack bundles: a published version payload (`dist/objectstack.json`) nests its meta under `.manifest` while ObjectQL's registerApp expects the flat app shape — every install of a published compiled bundle failed with "Invalid manifest payload". The handler now flattens the bundle shape (both the cloud-fetch and inline/file-import paths).
