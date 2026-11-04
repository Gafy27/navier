# What bounds a Temporal turn's lifetime

**Kind:** module
**Source:** `/workspace/attach/navier/src` (Navier src (navier.zip), owner code, read-only, pin `zip 2026-11-04`). Cites below are `tree/path:line` relative to each root.
**Concerns:** P5.1, P5.4
**Verdict axis:** live
**Status:** ready

**Question:** How long can an in-flight Temporal turn live after new turns move to DBOS?

## Answer in plain language

A running turn is bounded by `maxSteps` times the model and tool timeouts and retries; a paused turn by its agent version's `pauseTimeout`, after which the reaper ends it; a crashed one by `maxRecoveries` reaper restarts. The reaper and its schedule must therefore keep running until no non-terminal Temporal turn remains.

## Why it matters for this project

Gives the drain end condition and keeps the Temporal worker and reaper alive until then.

## How it works

Read limits, reaper end-pause, and the timeouts in runtime config.

## Key findings and evidence

- Limits incl. pauseTimeout and maxRecoveries. [S] `navier/agents/limits.ts:13-28`
- Timeouts. [S] `navier/runtime/config.ts:4-13`
- Reaper ends pauses. [S] `navier/runtime/reaper.ts:472-512`
- Reaper restarts. [S] `navier/runtime/reaper.ts:272-306`
- Reaper schedule. [S] `navier/runtime/schedule.ts:19-56`

## Limits and unknowns

Production limit values unknown.

## Research recommendation

**Recommendation:** adopt — drain end = zero non-terminal Temporal-owned messages; keep Temporal worker + reaper until then.
**Why / consequences:** Moving paused turns would need a second implementation of resume.
**Do not copy:** Cite. Notes describe and cite; no product code enters this repository.

## Technical references

### File map

#### P0 — read first

| File / source | What question it helps verify |
|---------------|-------------------------------|
| `navier/agents/limits.ts` | limits |

#### P1 — implementation detail

| File / source | When to open it |
|---------------|-----------------|
| `navier/runtime/reaper.ts` | pause end |
