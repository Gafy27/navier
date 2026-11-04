# Reaper, recovery and claims function by function

**Kind:** module
**Source:** `/workspace/attach/navier/src` (Navier src (navier.zip), owner code, read-only, pin `zip 2026-11-04`). Cites below are `tree/path:line` relative to each root.
**Concerns:** P3.1, P3.3
**Verdict axis:** live
**Status:** ready

**Question:** What does each reaper function do and what replaces it on DBOS?

## Answer in plain language

The reaper lists stale `created` messages older than the start grace, decides restart / stop / give up (stop wins, then the recovery cap), checks Temporal for an open execution, claims a recovery seq, and restarts the workflow or the promoted message; a second pass ends expired or stopped pauses. Everything except "close a message whose execution is gone" exists because starts were not atomic, executions could vanish, and pauses had no live workflow.

## Why it matters for this project

Only the final close survives as the audit sweep; DBOS recovery, atomic starts and recv deadlines remove the rest.

## How it works

Read each function and its callers.

## Key findings and evidence

- listStaleTurns. [S] `navier/runtime/reaper.ts:69-96`
- decide plan. [S] `navier/runtime/reaper.ts:108-138`
- hasOpenExecution. [S] `navier/runtime/reaper.ts:161-174`
- claim via recovery. [S] `navier/runtime/reaper.ts:194-226`
- restart / restartPromoted. [S] `navier/runtime/reaper.ts:229-269`
- recoverOne. [S] `navier/runtime/reaper.ts:272-306`
- sweep. [S] `navier/runtime/reaper.ts:336-357`
- ended pauses. [S] `navier/runtime/reaper.ts:388-512`
- recovery table. [S] `navier/runtime/migrations/04_0012_recovery.ts:1-18`
- maxRecoveries default. [S] `navier/agents/limits.ts:13-28`
- step claim. [S] `navier/runtime/model-step.ts:210-249`

## Limits and unknowns

No production data on how often each pass fires.

## Research recommendation

**Recommendation:** adapt — keep the close of orphaned rows as a sweep; delete restarts, claims, grace, pause passes on DBOS.
**Why / consequences:** A workflow dead-lettered or cancelled outside Navier runs no finish code.
**Do not copy:** Cite. Notes describe and cite; no product code enters this repository.

## Technical references

### File map

#### P0 — read first

| File / source | What question it helps verify |
|---------------|-------------------------------|
| `navier/runtime/reaper.ts` | all passes |

#### P1 — implementation detail

| File / source | When to open it |
|---------------|-----------------|
| `navier/agents/limits.ts` | limits |

#### Skip

| Path / source | Why it is outside this question |
|---------------|---------------------------------|
| `navier/runtime/schedule.ts` | Temporal schedule, frozen |
