---
"@objectstack/service-automation": minor
"@objectstack/runtime": minor
"@objectstack/spec": minor
---

Screen-flow runtime — interactive `screen` nodes (suspend → render → resume).

A `screen` node that declares input fields now suspends the run on entry
(reusing the ADR-0019 durable pause), surfaces a `ScreenSpec` describing the
form, and resumes with the collected values applied as **bare** flow variables
so downstream nodes read them via `{var}`. (`waitForInput: false` forces the
old server pass-through.)

- **spec**: `AutomationResult.screen?: ScreenSpec`, `ResumeSignal.variables?`
  (bare vars), `IAutomationService.getSuspendedScreen?(runId)`.
- **service-automation**: the `screen` executor builds the `ScreenSpec` and
  suspends when fields are present; the suspend/resume plumbing threads the
  screen through `FlowSuspendSignal` → `SuspendedRun` → the paused result;
  `resume()` sets `signal.variables` as bare flow variables; `getSuspendedScreen`.
- **runtime**: `POST /api/v1/automation/:name/runs/:runId/resume` (body
  `{ inputs }`) and `GET …/runs/:runId/screen`, wired through both the
  dispatcher route table and `handleAutomation`.

Verified end-to-end headlessly: the showcase Reassign Wizard launches → pauses
at the "New Assignee" screen → resumes with the input → the task is reassigned.
The objectui `FlowRunner` UI that renders these screens ships separately.
