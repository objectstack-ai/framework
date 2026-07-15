---
'@objectstack/rest': patch
---

fix(rest): mapDataError now honors an explicit 4xx `error.status`/`error.code` carried by domain errors (#2926 ⑦). Record-scope authorization denials from plugin-sharing (status 403, code FORBIDDEN) previously degraded to a bare 400 with no machine-readable code because the generic data routes bypass sendError's status passthrough. Structured 409 envelopes (CONCURRENT_UPDATE, DELETE_RESTRICTED) keep their dedicated branches; 5xx statuses still go through the message-sanitizing heuristics.
