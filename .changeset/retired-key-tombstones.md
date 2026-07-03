---
'@objectstack/spec': minor
---

Upgrade path for retired spec keys — the error IS the guide:

- **Tombstone entries** in `UNKNOWN_KEY_GUIDANCE`: `create()` rejecting a retired key (`compactLayout`, the `detail` block, object-level `views`, `defaultDetailForm`) now names the replacement, the version/decision that removed it, and the one-line fix — instead of a bare unknown-key error. Tombstones age out ~two majors after the removal.
- **`CHANGELOG.md` now ships inside the npm package** (`files` allowlist): every breaking entry's migration notes travel with the exact version installed, greppable offline from `node_modules/@objectstack/spec/CHANGELOG.md`.
- **`llms.txt` gains an "Upgrading Across Spec Versions" section** teaching agents the two-step protocol: read the tombstone, then grep the shipped CHANGELOG — and never to re-add rejected keys or downgrade to silence errors.
