---
"@objectstack/app-crm": patch
---

CRM example: set Sales Dashboard as the default landing via `homePageId`.
Previously users landed on the Lead list, which is one object out of
many and not a meaningful starting point for sales reps or managers.
The Sales Dashboard already aggregates pipeline KPIs, deal-stage funnel,
and revenue trend, so it makes a much better "first impression" for the
canonical CRM use case.
