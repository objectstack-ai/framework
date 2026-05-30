---
'@objectstack/cli': patch
---

**`os start` no longer silently shifts ports on a conflict.**

Port resolution is unchanged (`--port` › `$OS_PORT` › `$PORT` › `3000`), but the
conflict behaviour is now mode-dependent:

- **Dev** (`os dev`, or `NODE_ENV=development`): still auto-hops to the next free
  port (up to +100) so multiple example apps can run side-by-side. The startup
  banner shows the actual bound port.
- **Production** (`os start`): if the resolved port is busy, the CLI now fails
  loudly and exits `1` instead of binding a different port. A silently drifted
  port breaks reverse-proxy upstreams, better-auth callback URLs (`OS_AUTH_URL`),
  and CORS trusted-origins (`OS_TRUSTED_ORIGINS`) as opaque 403/502s.

Also fixed: the `os start` startup banner now prints the real Console URL when
the port comes from `$PORT`/`$OS_PORT` (previously it always showed the
`--port`/`3000` value, which could be wrong).
