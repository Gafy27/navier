# Temporal features used and the machinery around them

**Kind:** module
**Source:** `/workspace/attach/navier/src` (Navier src (navier.zip), owner code, read-only, pin `zip 2026-11-04`). Cites below are `tree/path:line` relative to each root.
**Concerns:** P0.2 inventory, P0.4 audit, P1.3 freeze
**Verdict axis:** live
**Status:** ready

**Question:** Which Temporal features does Navier use, and which surrounding pieces exist only to compensate for Temporal?

## Answer in plain language

Navier uses signals (cancel, graceful_stop, interrupt), cancellation scopes with non-cancellable finish and pause, continue-as-new on long histories, workflow-id conflict and reuse policies, an OrgId search attribute, schedules for the reaper and the stream sweep, trace interceptors, activity attempt numbers, replay tests, a health probe and a worker bootstrap. Around them sit a reaper (lost starts, dead workflows, ended pauses), a recovery table capping restarts, a step_claim table so a retried activity does not call the model twice, and a stop_requested table so a stop survives states with no running workflow.

## Why it matters for this project

Each compensation has a cause; the DBOS path removes the causes, so most compensations can go.

## How it works

Grepped `@temporalio` imports, then read each consumer and the migrations it relies on.

## Key findings and evidence

- Three signals. [S] `navier/runtime/workflow.ts:20-22`
- Non-cancellable pause and finish. [S] `navier/runtime/turn-loop.ts:192-228`
- continue-as-new on full history. [S] `navier/runtime/turn-loop.ts:79-87`
- Conflict FAIL, reuse ALLOW_DUPLICATE, search attribute. [S] `navier/runtime/start.ts:42-69`
- Reaper schedule with overlap SKIP. [S] `navier/runtime/schedule.ts:19-56`
- Stream sweep schedule. [S] `navier/runtime/stream-sweep.ts:57-95`
- Trace interceptors and attempt. [S] `navier/temporal/trace.ts:18-74`
- Replay harness. [S] `navier/temporal/replay.ts:13-45`
- Reaper sweep. [S] `navier/runtime/reaper.ts:336-357`
- Recovery claim. [S] `navier/runtime/reaper.ts:194-226`
- step_claim table. [S] `navier/runtime/migrations/04_0010_step_claim.ts:1-18`
- stop_requested table. [S] `navier/runtime/migrations/04_0011_stop_requested.ts:1-18`

## Limits and unknowns

Replay fixtures are outside the zip.

## Research recommendation

**Recommendation:** adapt — freeze everything Temporal-specific under `src/runner/temporal/`; give each compensation a verdict in [P0.4](../PHASE0_P0.4_SIMPLIFICATION_AUDIT.md).
**Why / consequences:** Rewriting the Temporal path would be new work on a frozen adapter.
**Do not copy:** Do not quote reaper SQL into designs; cite it. Notes describe and cite; no product code enters this repository.

## Technical references

### File map

#### P0 — read first

| File / source | What question it helps verify |
|---------------|-------------------------------|
| `navier/runtime/reaper.ts` | compensations |
| `navier/runtime/start.ts` | start options |

#### P1 — implementation detail

| File / source | When to open it |
|---------------|-----------------|
| `navier/temporal/trace.ts` | tracing |

#### Skip

| Path / source | Why it is outside this question |
|---------------|---------------------------------|
| `navier/temporal/probe.ts` | probe, trivial |
