# React-tier authoring dogfood (ADR-0081)

Goal: prove the loop the react-tier was built for actually closes — **an author
(human or AI) writes a `kind:'react'` page knowing every component's props from
the contract, and `os validate` catches it when they don't.** Not "the gate has
unit tests" — an end-to-end run through the real CLI on a real app.

## The loop

1. **Contract** — `skills/objectstack-ui/references/react-blocks.md` lists every
   injected block (`<ObjectForm>`, `<ListView>`, `<ObjectChart>`, `<RecordHighlights>`,
   `<RecordRelatedList>`, `<RecordPath>`, …) and the exact props each accepts,
   tagged `data` / `binding` / `controlled` / `callback`. It is **generated** from
   the spec schemas (`packages/spec/src/ui/react-blocks.ts`), so it can't drift
   into fiction.
2. **Author** — `examples/app-showcase/src/pages/renewals-pipeline.page.ts` was
   written straight from that contract (no guessing): a renewals manager works a
   `<ListView>` of accounts, and selecting one drives `<RecordHighlights>` +
   `<ObjectChart>` + `<RecordRelatedList>` and a slide-out `<ObjectForm formType="drawer">`.
   Five server-connected blocks, every prop taken from the contract.
3. **Gate** — `os validate` step 3d (`validateReactPageProps`, ADR-0081 Phase 2)
   parses each react page's real JSX and checks block usage against the contract.

## Evidence

**Authored-correctly → passes.** With the page wired into the showcase stack:

```
→ Checking React-source page props (ADR-0081)...
✓ Validation passed (98ms)            # exit 0
```

**Authored-wrong → caught.** Injecting two realistic mistakes — dropping the
required `objectName` binding on `<ObjectChart>`, and a `onSucces` typo of the
`onSuccess` callback on `<ObjectForm>`:

```
⚠ page "showcase_renewals_pipeline" › <ObjectForm>: <ObjectForm> has prop "onSucces" — did you mean "onSuccess"?
✗ React-source page prop check failed (1 issue)
  • page "showcase_renewals_pipeline" › <ObjectChart>: <ObjectChart> is missing the required prop "objectName".
      rule: react-prop-missing-required  at pages[29].source
                                          # exit 1
```

The missing required binding is an **error** (fails the build); the near-miss prop
name is a **warning** (likely typo, surfaced but non-fatal — the contract's data
props are a curated subset so arbitrary unknown props aren't flagged, keeping
false positives near zero).

## Conclusion

The three pieces — **generated contract**, **author reads it**, **validate enforces
it** — compose into a working loop. An AI handed `react-blocks.md` writes correct
props, and a wrong prop is caught at `os validate` time before it ever renders.
`renewals-pipeline.page.ts` stays in the showcase as the golden, validated example.
