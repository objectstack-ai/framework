---
"@objectstack/spec": patch
---

Sync `PROTOCOL_VERSION` to `14.0.0` — the 14.0.0 release bumped `package.json` but the handshake constant still said 13, so `protocol-version.test.ts` failed on main for every PR. (Process note: the changesets Version PR cannot bump source constants; the protocol bump must accompany each major.)
