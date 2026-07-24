---
'@objectstack/cloud-connection': patch
'@objectstack/runtime': patch
'@objectstack/cli': patch
---

Surface marketplace rehydrate/heal seed outcomes in the `os dev` / `os serve` boot banner (#3430), extending the config-app Seeds line from #3415.

The seed pipeline's most useful result lines are all `logger.info`, but `os dev` forwards a default `warn` level and the serve boot-quiet window swallows stdout — so "marketplace package rehydrated onto a fresh DB with 0 rows", a fresh-DB self-heal, and row-level seed failures were all invisible unless you queried the database directly.

The `seed-summary` kernel service is now a per-source list. AppPlugin (config apps) and the marketplace rehydrate/heal path each contribute a labelled entry, and the banner prints one combined line that ignores the log level:

```
Seeds:   showcase 162 rows · hotcrm(marketplace) 157 ok / 5 errors ⚠
```

Fresh-DB heals are marked `(healed on fresh db)`; a marketplace package that installed with seed datasets but landed 0 rows, and any run that dropped records, escalate to a yellow `⚠` line instead of passing silently.
