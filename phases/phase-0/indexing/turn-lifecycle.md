# Navier turn lifecycle (rows, workflow, activities)

**Kind:** module
**Source:** `/workspace/attach/navier/src` (Navier src (navier.zip), owner code, read-only, pin `zip 2026-11-04`). Cites below are `tree/path:line` relative to each root.
**Concerns:** P0.1 map, P0.4 audit, P2.1 workflow
**Verdict axis:** live
**Status:** ready

**Question:** What happens, in order, from a posted user message to the closed agent message, and where is the state?

## Answer in plain language

`postTurn` writes the user and agent message rows (or a pending row) in one transaction, then `startCommitted` starts a Temporal workflow whose input holds ids only. The workflow loads the turn, runs model steps and tool calls as activities, and every write is a guarded append that checks the newest status, so a repeated activity writes nothing new. Pauses end the workflow; `decide` restarts it with the same id. `closeTurn` promotes or drops pending messages and the stream hub delivers deltas from a Postgres table over LISTEN/NOTIFY.

## Why it matters for this project

Shows that Temporal holds almost no turn state: rows and guarded appends already give idempotency, so the runner can be swapped without moving state.

## How it works

Followed `postTurn` → `startCommitted` → `turnWorkflow` → `runTurn` → activities, then `decide` and `closeTurn`.

## Key findings and evidence

- postTurn writes rows then starts. [S] `navier/runtime/post.ts:475-502`
- startCommitted logs a failed start and leaves it to the reaper. [S] `navier/runtime/start.ts:83-112`
- Workflow input is ids only. [S] `navier/runtime/workflow-types.ts:13-18`
- Turn loop. [S] `navier/runtime/turn-loop.ts:136-189`
- Guarded append primitive. [S] `navier/db/append.ts:42-75`
- Model step read/claim/generate/commit. [S] `navier/runtime/model-step.ts:512-564`
- Tool call. [S] `navier/runtime/tool-call.ts:370-547`
- Pause snapshot and expiry. [S] `navier/runtime/close.ts:299-346`
- decide restarts with the same id. [S] `navier/runtime/decide.ts:514-533`
- closeTurn CAS and pending promotion. [S] `navier/runtime/close.ts:47-125`
- Delta append with NOTIFY. [S] `navier/runtime/stream.ts:62-104`
- SSE hub. [S] `navier/api/stream-hub.ts:41-100`

## Limits and unknowns

Did not run Navier; no package.json or tests directory in the zip.

## Research recommendation

**Recommendation:** keep — rows, guarded appends, delta table and hub; replace only the scheduler and its compensations.
**Why / consequences:** Moving state into workflow events would duplicate the row model the API already reads.
**Do not copy:** Navier source is the owner's code; cite, do not restate whole functions. Notes describe and cite; no product code enters this repository.

## Technical references

### File map

#### P0 — read first

| File / source | What question it helps verify |
|---------------|-------------------------------|
| `navier/runtime/turn-loop.ts` | loop |
| `navier/runtime/model-step.ts` | model step |

#### P1 — implementation detail

| File / source | When to open it |
|---------------|-----------------|
| `navier/runtime/close.ts` | close/pause |
| `navier/runtime/decide.ts` | approval |

#### Skip

| Path / source | Why it is outside this question |
|---------------|---------------------------------|
| `navier/runtime/prompt.ts` | prompt assembly, runner-neutral |
