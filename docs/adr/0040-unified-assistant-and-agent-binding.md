# ADR-0040: Unified Assistant — the end user never picks an agent

> **⚠️ Superseded by [ADR-0063](./0063-two-kernel-agents-skills-are-the-extension-primitive.md)** (2026-06-22). Its core decision — a *single* unified assistant carrying all skills, switched by a per-turn intent classifier — was **reversed**: the kernel now ships two agents (`ask` / `build`) bound by *surface*, and `*.agent.ts` is closed to third parties (skills are the extension primitive). The UX win it established (the user never picks from a roster) is kept, re-grounded as surface binding. Kept below as a historical record of the decision and the incident that motivated it.

**Status**: **Superseded by [ADR-0063](./0063-two-kernel-agents-skills-are-the-extension-primitive.md)** — original: Proposed (2026-06-11)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0033](./0033-ai-assisted-metadata-authoring.md) (draft-gated authoring tools the assistant drives), [ADR-0038](./0038-build-verification-loop.md) (the verify-fix-reverify discipline carried by skills), ADR-0037 / [framework#1694](https://github.com/objectstack-ai/framework/pull/1694) (Live Canvas — the surface the unified assistant builds into)
**Consumers**: `@objectstack/spec` (agent/skill types — clarified, not changed), `@objectstack/service-ai` (default agent composition), `../cloud/service-ai-studio` (authoring skills attach to the platform assistant), `../objectui` (chat surfaces drop the agent picker)

**Premise**: pre-launch, no back-compat debt — specify the target end-state directly.

**Design center**: **the end user talks to "the assistant of this app" — never to a roster.** Asking a business user to choose between "Data Assistant" and "Metadata Assistant" leaks an internal implementation detail and produces the worst failure mode we shipped: the wrong persona accepts the job, lacks the right discipline, and the user watches it flail.

---

## TL;DR

**The incident that forces the decision** (staging, 2026-06-11): a user asked the *Data Assistant* — the default chat persona — to "build a library app with a dashboard". Tools are registry-global, so it *could* author metadata; but the authoring **disciplines** live in skills it didn't carry (`solution_design`'s plan-first blueprint, `metadata_authoring`'s "don't narrate failures"). Result: it hand-rolled objects field-by-field, collided with a leftover `book` object, fell into a draft-visibility loop, and narrated its own debugging ("add_field said the field exists, but it doesn't") to a business user. The same prompt to the *Metadata Assistant* builds cleanly — but the user had no way to know that, **and should never have to**.

**Decision.**

1. **One platform assistant for people.** The default agent carries *all* platform skills — data exploration *and* metadata authoring (`data_explorer`, `actions_executor`, `metadata_authoring`, `solution_design`) — with a short intent preamble: classify the ask (build/change structure vs. query data) and apply that skill's discipline. The skills system already *is* the per-intent behavior mechanism; routing between sibling agents would re-implement it worse (added latency, misclassification, mid-conversation handoff).
2. **The agent picker leaves consumer UX.** Chat surfaces resolve the assistant; they do not offer a roster. Explicit pinning (`?agent=`, API `agents/:name/chat`) remains for builder/developer surfaces (Studio) and programmatic callers.
3. **`agent` stays in the spec — redefined as the *binding unit*, selected by *scenario*, configured by *builders*.** Multiple agents exist so different surfaces bind different assistants; the runtime resolution chain (`app.defaultAgent` → platform default → first active) makes the choice deterministic without user input.
4. **Custom agents are a builder/admin feature**, bound per app, authored as metadata through the same draft → verify → publish pipeline as everything else. Platform guardrails remain a floor no custom agent can lower.
5. **Honest gap, named**: today tools are registry-global and skills carry *instructions only* — a custom agent can change persona, model, and discipline, but **cannot yet constrain capability**. True capability boundaries need **tool scoping** (below), specified here as the follow-up contract.

---

## Context

### What an `agent` actually is (and why skills can't replace it)

The agent record carries everything a *deployed assistant* needs that a skill cannot express:

| Agent-level | Why it can't live on a skill |
|---|---|
| `model {provider, model, temperature, maxTokens}` | cost/quality tier is per-assistant, not per-capability |
| `guardrails {blockedTopics, maxExecutionTimeSec, maxTokensPerInvocation}` | safety/governance envelope around the whole loop |
| `planning {strategy, maxIterations, allowReplan}` | agentic-loop behavior |
| `memory {shortTerm…}` | conversation window |
| `instructions / role / label` | the persona's voice and identity |
| `skills: [...]` | the composition itself |

**Agent = assembled runtime configuration + governance unit. Skill = reusable capability fragment (tools list + usage discipline).** Deleting the agent type would orphan the model binding and the governance envelope; deleting user-facing agent *choice* costs nothing.

### Who selects the agent, if not the user?

The existing resolution chain (already implemented in `agent-runtime.resolveDefaultAgent`):

1. **`app.defaultAgent`** — the app the user is in selects its assistant (a builder decision made at configuration time);
2. the **platform default** (`data_chat` — after this ADR, the unified assistant);
3. first active agent (stripped-down deployments).

The analogy that settles it: *agents are to assistants what views are to lists.* An object may define five views; the end user opening a tab doesn't choose among them — the app's navigation does. Nobody asks "why define multiple views, and which one is used?" — binding answers both. A defined-but-unbound agent is simply dormant (API-reachable, bindable later), exactly like a dashboard no nav entry points at.

### Surfaces and their selectors

| Surface | Agent | Selected by |
|---|---|---|
| Console chat / Build-with-AI | unified platform assistant | platform (resolution chain) |
| Any app with `defaultAgent` | that agent | **app builder** |
| Studio | `metadata_assistant` via explicit `?agent=` pin | platform (a developer surface) |
| API / MCP callers | named in the request | the program |
| Eval suite (ADR-0038 L5), flow AI steps | named per case/step | the machine |

## Decision

### 1. Unified platform assistant (`service-ai` + cloud)

- The platform default agent's `skills` become the union: `['data_explorer', 'actions_executor', 'metadata_authoring', 'solution_design']`. The cloud's AI Studio plugin keeps owning the two authoring skills; on deployments without it, the skill references simply don't resolve and the assistant degrades to data-only — same graceful-absence rule the registry already applies.
- Base instructions gain an **intent preamble**: *first decide whether the user wants to build/change structure (use the solution-design / authoring disciplines) or query data (use data exploration); never mix the registers.* Skills already carry their own "use this when…" prose; the preamble only forces the classification step.
- Guardrails take the strictest union of the merged personas (authoring's `blockedTopics`, low temperature for build turns).
- The ADR-0038 L5 golden-prompt suite is the regression net for unification: build prompts must still produce clean verified builds, data prompts must still answer — both against the *same* assistant.

### 2. Consumer surfaces drop the picker (objectui)

- The chat page resolves the assistant and shows its label — no roster dropdown. The picker renders only when an explicit `?agent=` pin is present (builder/developer flows) or in a future admin surface.
- Floating chat already followed app binding; unchanged.

### 3. Custom agents — builder feature, same pipeline

- Builders/admins may define agents (persona, model tier, instructions, skill list) as `type:'agent'` metadata and bind them via `app.defaultAgent`. Definition rides ADR-0033 (draft → publish) and ADR-0038 (verifiable); no parallel lifecycle.
- Platform guardrails are a **floor**: deployment-level limits (blocked topics, token/time ceilings) apply regardless of what a tenant agent declares.

### 4. The tool-scoping gap (follow-up contract, named honestly)

Today `chatWithTools` offers the **whole tool registry** to every agent; skills contribute instructions, not access control. Consequences to fix in a follow-up:

- An agent's effective tool set should be **derivable from its skills** (`skill.tools` as an allowlist) plus an explicit `agent.tools` override — enforced at the runtime boundary (tool execution rejects out-of-scope calls), not just by prompt.
- Until then, a "read-only analyst" custom agent is a *persona*, not a *boundary* — documented as such wherever custom agents are exposed.
- This incident is also why scoping matters beyond security: the Data Assistant failed precisely because it could reach tools whose disciplines it didn't carry.

### 5. Build-scope rule — oversized goals decompose into phased modules

A "build me a whole ERP, hundreds of tables" goal must not become one mass-generated blueprint: it is unreviewable in the blueprint-confirm step (ADR-0033's safety valve), unbuildable inside the agent's per-turn runtime budget, and design coherence collapses at that scale. The platform's answer is **consultative decomposition**, in two layers sharing one limit:

- **Soft (design-time)** — `propose_blueprint` carries a SCALE rule: a single blueprint never exceeds the per-build object cap (aim ≤10). Larger goals blueprint ONLY the core module (smallest object set with end-to-end value); the remaining modules are emitted as a phased roadmap in `assumptions`. Later phases are ordinary follow-up blueprints in the same environment, referencing earlier objects via lookups.
- **Hard (apply-time)** — `apply_blueprint` rejects an oversized blueprint **before staging anything** (`code: 'blueprint_too_large'`), returning the same decomposition guidance so the agent re-proposes instead of retrying. The cap defaults to 20 and is read from one per-context limit (`BlueprintToolContext.limits.maxBlueprintObjects`) — the designated read point for plan-tier entitlements (a free tier is the same code path with a smaller N and the upsell moment built into the roadmap).

**Perception rule**: limits that can manifest as *advice* stay invisible — the agent frames phasing as professional delivery methodology, never as a system or plan limitation. Limits that can only manifest as *refusal* (quota exhausted) must be stated honestly at the moment of impact, with a recovery path. An invisible wall the user can hit reads as "the AI is broken," which is the most expensive failure mode.

Verified by the L5 suite's `golden_erp_scope` case: an "entire ERP" prompt must yield a bounded core-module build plus a roadmap, never dozens of staged objects.

## Non-goals

- **Not** removing the multi-agent system — binding, API selection, eval, and channels all need it.
- **Not** an intent router between sibling agents — the skills mechanism is the per-intent behavior system; a router duplicates it with worse failure modes.
- **Not** merging Studio's pinned authoring persona — developer surfaces may keep specialist pins.

## Risks

| Risk | Mitigation |
|---|---|
| Fat prompt blurs registers (build turn sounds like an analyst) | intent preamble + per-skill discipline prose; L5 suite asserts both registers per deploy |
| Token cost of carrying all skill instructions | skills' instruction blocks are short; `triggerConditions` can structurally gate (e.g. authoring skills only in builder contexts) if cost shows up |
| Tenant expectations of capability-bounded custom agents | the gap is documented; tool scoping is the named follow-up before custom agents are marketed as boundaries |
