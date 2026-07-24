---
'@objectstack/runtime': patch
'@objectstack/cli': patch
---

Surface seed outcomes in the `os dev` / `os serve` boot banner (#3415). Seeds run inside the boot-quiet stdout window and SeedLoader's logs sit under the default warn level, so a fixture could silently lose most of its rows — the showcase shipped 1 of 5 projects with zero terminal signal. AppPlugin now stashes the per-boot seed counters on the kernel (`seed-summary` service) and the banner prints `Seeds: X inserted · Y updated · Z skipped`, escalating to a yellow `⚠ … N REJECTED` line when records were dropped.
