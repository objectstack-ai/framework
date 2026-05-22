---
'@objectstack/metadata': minor
'@objectstack/studio': minor
---

ADR-0008 M0 PR-9: thread the canonical server-side change-log `seq` from
`MetadataRepository` events through to the Studio HMR badge. The
`useMetadataHmr()` hook now exposes `lastSeq` alongside the local
`version` counter, and the badge tooltip renders "Repo seq: #N" so
operators can correlate Studio reloads with what other replicas observe.
Legacy chokidar-driven events still work — they simply leave `seq`
undefined and consumers fall back to the local counter.
