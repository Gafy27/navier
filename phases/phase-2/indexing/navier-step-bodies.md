# Navier step bodies the workflow wraps

**Kind:** module
**Source:** `/workspace/attach/navier/src` (Navier src (navier.zip), owner code, read-only, pin `zip 2026-11-04`). Cites below are `tree/path:line` relative to each root.
**Concerns:** P2.2 steps
**Verdict axis:** live
**Status:** ready

**Question:** What do loadTurn, modelStep and toolCall assume about attempts, run keys, retries and abort?

## Answer in plain language

`modelStep` reads committed state, claims the step, calls the model outside a transaction while publishing deltas, and commits with a guarded append keyed by step index and run key. `toolCall` treats a `running` row with an attempt at or above the current attempt as an interrupted earlier attempt and closes it unless the tool may retry. Both take the Temporal attempt; the run key is the first execution run id.

## Why it matters for this project

The attempt and run key are the only Temporal-derived inputs inside step bodies.

## How it works

Read the args types and the guard logic.

## Key findings and evidence

- ModelStepArgs attempt and runKey. [S] `navier/runtime/model-step.ts:32-43`
- readCommitted. [S] `navier/runtime/model-step.ts:118-207`
- guarded commit. [S] `navier/runtime/model-step.ts:352-473`
- publisher. [S] `navier/runtime/model-step.ts:480-505`
- runKey from firstExecutionRunId. [S] `navier/runtime/turn-loop.ts:150`
- interrupted rule. [S] `navier/runtime/tool-call.ts:440-467`
- running claim. [S] `navier/runtime/tool-call.ts:468-484`
- Retryable codes. [S] `navier/runtime/activities.ts:89-103`
- Tool pool. [S] `navier/runtime/turn-loop.ts:94-133`

## Limits and unknowns

Tests absent.

## Research recommendation

**Recommendation:** adopt — wrap bodies unchanged; runKey = workflow id; attempt derived from stored rows.
**Why / consequences:** Changing bodies would break the frozen adapter that shares them.
**Do not copy:** Cite. Notes describe and cite; no product code enters this repository.

## Technical references

### File map

#### P0 — read first

| File / source | What question it helps verify |
|---------------|-------------------------------|
| `navier/runtime/model-step.ts` | model step |
| `navier/runtime/tool-call.ts` | tool call |

#### P1 — implementation detail

| File / source | When to open it |
|---------------|-----------------|
| `navier/runtime/turn-loop.ts` | pool |

#### Skip

| Path / source | Why it is outside this question |
|---------------|---------------------------------|
| `navier/runtime/output.ts` | output shaping |
