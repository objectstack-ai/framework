---
"@objectstack/spec": patch
---

chore(liveness): bring `page` under the spec liveness gate

Onboards the `page` metadata type to the ADR-0049/#1919 liveness ledger
(`packages/spec/liveness/page.json`) and adds it to the governed-types list in
`check-liveness.mts`. Every authorable PageSchema property now declares a
status with evidence: 17 properties — 14 `live` (objectui renderer consumers
cited as prose), 1 `experimental` (`variables` — provider/hook exist, no
end-to-end consumer), 2 `dead` (`recordReview` / `blankLayout` — their page
types were removed in framework#2265 and objectui dropped all references in
objectui#1949; the fields stay @deprecated pending hard-removal). CI now fails
if a new page property lands unclassified.
