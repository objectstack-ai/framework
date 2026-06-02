# ADR-0033: AI-assisted metadata authoring — one agent brain, draft-gated review, type-agnostic apply, open-core boundary

**Status**: Accepted (2026-06-02)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0005](./0005-metadata-customization-overlay.md) (one Zod source per type + org overlay), [ADR-0010 (protection)](./0010-metadata-protection-model.md) (L1/L2/L3 protection), [ADR-0010 (NL→flow)](./0010-nl-to-flow-authoring.md) + [ADR-0011](./0011-actions-as-ai-tools.md) (AI authoring of metadata / actions-as-tools — **the design center**), [ADR-0019](./0019-approval-as-flow-node.md) (approvals as a flow node), [ADR-0027](./0027-metadata-authoring-lifecycle.md) (**staged authoring · draft · publish · promote** — *this ADR routes every AI write through its draft workspace*), [ADR-0032](./0032-unified-expression-layer.md) (validate-by-default, AI-authored expressions)
**Consumers**: `@objectstack/services/service-ai` (agents, skills, tools, the structured-output/blueprint path), `@objectstack/spec` (per-type Zod schemas + structured-output targets), `@objectstack/rest` (`/meta/*?mode=draft`, `/api/v1/ai/*`), `@objectstack/cli`, `../objectui` (Studio: per-type designers, the global chat, the review/diff confirm surface)

**Premise**: the platform is **pre-launch** — no production metadata in the wild, no external authors, no back-compat debt. This ADR specifies the **target end-state directly**, no deprecation path.

**Design center**: **the long-term author of metadata is an AI; the human confirms and makes simple edits.** This is the same assumption as ADR-0032 carried into the *authoring loop itself*. It reorders the design: the question is not "what buttons does each designer need" but "**how does an AI propose a change to any metadata type, and how does a human safely confirm it before it goes live.**"

---

## TL;DR

1. **One brain, many surfaces.** AI generation/modification of metadata is **centralized in the agent + global chat** (the `metadata_assistant` and its successors), *not* re-implemented as a bespoke "generate" feature inside each designer. Every metadata type — object, view, dashboard, flow — is authored through the same conversational surface. Designers contribute *context* and *in-context entry points*, never their own AI logic.
2. **AI never publishes — it drafts.** Every agent metadata mutation writes to the **ADR-0027 draft workspace** (`mode:'draft'`), never to the live schema. The change surfaces in the designer's **review/diff**, and the **human's Publish is the only path to production**. The draft *is* the approval gate — this supersedes the never-enforced `requiresConfirmation` flag on the metadata tools.
3. **Type-agnostic apply.** A single `update_metadata(type, name, patch, mode:'draft')` tool (+ `create_metadata`, `describe_metadata`) replaces N bespoke per-type write tools. Each patch is **validated against that type's Zod schema** (ADR-0005's one-Zod-per-type) before it enters the draft.
4. **Plan-first for vague intent.** Real authors say *"build me a project-management system,"* not a field list. For high-level goals the agent emits a **structured blueprint** (objects + relationships + views + dashboards + seed data) via structured output, the human **confirms/edits the blueprint**, and only then does it batch-draft. Never mass-generate unreviewed artifacts.
5. **Open-core boundary.** The authoring *brain* (agent framework, tools, **bring-your-own-model**) ships in **open source** — self-hostable, your own key, even a fully-local/offline model. The **enterprise** edition adds **managed AI** (no key, metered credits) and **organizational governance** (approval gate, environment promotion, audit, publish RBAC). The *capability* is open; *"managed + governed at scale"* is paid.

---

## Context — what exists (verified 2026-06-02)

**The pieces are already in the tree; they are not yet wired into a safe loop.**

- **Agents & tools (`service-ai`).** `metadata_assistant` ("Schema Architect", GPT-4) ships with a `metadata_authoring` skill and tools `create_object` / `add_field` / `modify_field` / `delete_field` / `list_objects` / `describe_object`. The global chat (objectui) already binds Studio to this agent and (per the objectui P1 work) forwards a `context.editing = { type, name, label, fields }` describing the open designer item. Structured output (`AIService.generateObject<T>()` against a Zod schema) exists.
- **The gap (safety).** Those tools call `metadataService.register(...)` which **publishes immediately** — no draft, no review, no gate. The `requiresConfirmation` flag exists but is **not enforced** (the tool-call loop ignores it; see the inline comments in `create-object.tool.ts`). So today an AI edit goes straight to the live schema. That directly contradicts the design center ("the human confirms").
- **The lifecycle already solves the storage half (ADR-0027).** The metadata repository (`sys-metadata-repository.ts`) already supports a `state:'draft'` for reads *and* writes; the Studio designer already uses `openDraft / stage / diff / publish / discard / promote`. There is a draft workspace; the AI tools simply do not use it.
- **The review half already exists client-side.** The objectui object designer ships a **review/diff mode** (draft ↔ last-published, added/changed/removed per field) and a draft→Publish flow. It is object-specific today.
- **Per-type designers exist.** objectui registers designers/inspectors for `view`, `dashboard`, `flow`, `page`, `report`, `app`. Editing those types in a GUI is not the gap.
- **Coverage gap.** Write tools cover only **objects + fields**; there are no tools for views / dashboards / flows.

So the loop is *almost* there: brain (yes), draft storage (yes), review UI (yes, object-only) — but AI writes bypass the draft, there is one tool per object-op instead of a general one, and nothing handles "design a whole solution from a vague ask."

### How mainstream platforms draw the AI line
Conversational builders that survived (Retool/Appsmith AI, Budibase, Supabase Studio + AI, n8n AI) converge on: **AI proposes, a human reviews a diff, a human commits**; the AI brain is one surface, not scattered; and self-hosters bring their own model while the vendor monetizes the *managed* model + *governance*. This ADR adopts that consensus.

---

## Decision

### 1. One authoring brain; designers contribute context, not AI logic

AI generation and modification of metadata is owned by the **agent layer + global chat**. Per-designer "generate with AI" features are **prohibited** as independent implementations — they would fork prompt/tool logic per type and never converge. Instead:

- Each designer **publishes editor context** (`{ type, name, label, fields? }`) to the chat (already done in objectui P1), so the agent acts on *"this object / this view"* without the user restating it.
- Designers expose a thin **"Ask AI"** affordance that **opens the existing global chat in-context** (no new chat surface).
- Growing coverage = adding **tools/skills** in `service-ai` (server-side), not UIs per designer.

### 2. AI never publishes — every write lands in the ADR-0027 draft

All agent metadata mutations route through the **draft workspace**:

- The metadata tools write with `state:'draft'` (the ADR-0027 `stage` path), **never** `register()`-to-published.
- The change is surfaced to the human in the designer's **review/diff**; **`publish` is a human action** (optionally gated — see §6).
- This makes the **draft the approval gate**. We **delete** the unenforced `requiresConfirmation` placeholder on metadata tools; "safe because nothing is live until a human publishes" is the model.
- Drafts are **decoupled from an open designer**: the AI may draft an object the author does not currently have open; the proposal waits in that item's draft and appears in review the next time it is opened (and, optionally, raises a "pending AI changes" badge).

### 3. Type-agnostic apply tool, validated per-type

Replace per-type write tools with a **small generic surface**:

- `create_metadata(type, name, definition, mode:'draft')`
- `update_metadata(type, name, patch, mode:'draft')` — applies a structured patch to the item's draft (field-level ops **read-modify-write the single object draft**, they do not fork drafts)
- `describe_metadata(type, name)` / `list_metadata(type)` — read side

Every write is **validated against the type's Zod schema** before entering the draft (ADR-0005: one Zod source per type). Invalid AI output is rejected with a precise, fixable error and **fed back to the agent** (same validate-by-default spine as ADR-0032) — never silently coerced, never partially applied. The legacy object/field tools become thin wrappers over `update_metadata` or are retired.

### 4. Plan-first for vague intent (the "design me a system" case)

For high-level goals the agent does **design**, not transcription, and **confirms before it builds**:

1. **Blueprint.** The agent emits a **structured blueprint** (via `generateObject` against a `SolutionBlueprintSchema`): proposed objects + fields + relationships + views + dashboards + seed data, with **stated assumptions**. It asks at most 1–2 structure-deciding questions; it does not interrogate.
2. **Confirm/edit.** The human reviews and adjusts the *blueprint* (cheap, nothing persisted).
3. **Batch-draft.** Only on approval does the agent fan out `create_metadata`/`update_metadata` calls — all into drafts (§2).
4. **Iterate.** Follow-ups ("split Task into Task + Subtask") re-draft and re-review.

**Mass-generating unreviewed artifacts from a vague prompt is prohibited.** The blueprint-confirm step is the safety valve for low-specificity input.

### 5. Review is type-agnostic and lives in the shared host

The confirm surface belongs at the **shared edit-page host**, not per-designer:

- A **generic structural diff** (draft ↔ last-published, added/changed/removed by path) covers **any** type — view, dashboard, flow — out of the box.
- **Per-type semantic diffs** (object field diff ✓ already; view columns/filters; dashboard widgets) are **enhancements layered on top**, added for high-value types first.
- **Flow (graph) is the hardest** and is sequenced last: a structural diff can *show* a flow change, but rich graph-aware review + AI flow editing is its own effort.

*(This §5 is the objectui half; specified here so the contract is one document.)*

### 6. Open-core boundary

| Layer | OSS | Enterprise |
|---|---|---|
| Agent framework, skills, **generic tools** (§3) | ✅ | ✅ |
| **Bring-your-own-model** (cloud key *or* local/offline OpenAI-compatible endpoint) | ✅ | ✅ |
| Visual designers + **single-author draft → review → publish** | ✅ | ✅ |
| Plan-first blueprint authoring (§4) | ✅ | ✅ |
| **Managed AI** (no key, metered credits, hosted models) | — | ✅ |
| **Governance**: publish **approval gate** (ADR-0019), environment **promotion** (ADR-0027), audit log of AI drafts, publish RBAC | — | ✅ |
| Real-time multi-author co-editing at scale | — | ✅ |

Rationale: the visual+conversational authoring loop is the **adoption funnel** — gating it loses to open competitors. The defensible monetization is **operational governance** (who may publish, across which environments, with what audit) and **managed convenience** (no model to run, no tokens to meter). The *capability* must be free; *running it safely and at scale for an organization* is paid. BYO-model also gives self-hosters a capability EE-managed cannot: **fully-private/offline AI authoring**.

---

## Consequences

**Positive**
- One conversational surface scales to **every** metadata type by adding server tools, not client UIs.
- **Safe by default**: nothing an AI writes is live until a human publishes; the long-standing "metadata tools persist immediately" hazard is closed structurally.
- Reuses what exists: the ADR-0027 draft lifecycle, the per-type Zod schemas (ADR-0005), the validate-by-default discipline (ADR-0032), and the objectui review/diff.
- Open-source remains genuinely useful (full AI authoring with your own/local model); enterprise has a clean, non-cannibalizing value story.

**Negative / costs**
- Requires per-type **structured-output + schema validation** wiring for `update_metadata`.
- The **generic structural diff** is universal but not pretty; rich per-type review is incremental work.
- **Flow** authoring/review (graph semantics) is high-effort and deferred.

**Open questions (resolve before GA)**
- **Conflict policy**: an AI draft vs the author's unsaved local edits to the same item — merge, queue, or block? (Lean: write to the same draft; if the client is dirty, prompt rather than clobber.)
- **Provenance & audit**: attribute each AI draft to the acting user + mark it AI-sourced (needed for the EE audit log).
- **Multi-author concurrency**: two humans + an AI drafting one item.

## Rollout (phased; maps to the open-core line)

- **Phase A (framework, OSS)** — `update_metadata`/`create_metadata` write `state:'draft'`; per-type Zod validation + error-feedback; result envelope `{ status:'drafted', type, name, summary, changedKeys }`; agent instructions: *propose drafts, never publish*. Retire the immediate-write object/field tools.
- **Phase B (objectui, OSS)** — chat surfaces "drafted N changes — review"; the open designer reloads the draft on signal and enters review/diff; generic structural diff at the host level (all types).
- **Phase C (framework, OSS)** — `SolutionBlueprintSchema` + plan-first blueprint flow; broaden tool/skill coverage to view/dashboard (flow last).
- **Phase D (enterprise)** — publish approval gate (ADR-0019), environment promotion (ADR-0027), AI-draft audit log, publish RBAC, managed/metered AI.
