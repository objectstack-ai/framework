---
"@objectstack/spec": minor
---

feat(action): `undoable` flag on the UI Action schema

Single-record update actions can declare `undoable: true`. The runtime captures
the record's prior field values and offers an "Undo" affordance on the success
toast (backed by the client UndoManager). Pairs with the objectui runtime that
honours it. Also documents that conditional `visible` / `disabled` CEL
predicates are evaluated by the action renderers (used here to hide an action
when it no longer applies, e.g. Convert Lead on an already-converted lead).
