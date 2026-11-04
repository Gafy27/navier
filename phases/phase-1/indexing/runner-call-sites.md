# Every runner call site in Navier

**Kind:** module
**Source:** `/workspace/attach/navier/src` (Navier src (navier.zip), owner code, read-only, pin `zip 2026-11-04`). Cites below are `tree/path:line` relative to each root.
**Concerns:** P1.1 interface, P1.2 port
**Verdict axis:** live
**Status:** ready

**Question:** Where does domain or API code start, signal, await, schedule or probe a workflow?

## Answer in plain language

Starts happen in `startCommitted` (called from `startTurn`, edit, retry, replay retry and the promoted start in `finishTurn`) and in `decide` (restart). Signals happen in `signalGracefulStop` (pending arm of `startTurn`) and `requestStop`. `awaitTurn` waits on the handle result. The worker composes the client, worker, and two schedules; the API and the SDK runtime each connect a client and register a probe.

## Why it matters for this project

Six operations — start, stop wake, decision wake, await, probe, close — cover every site, so the interface stays small.

## How it works

Grepped `temporal`, `startCommitted`, `signalGracefulStop`, `requestStop`, `awaitTurn` outside `temporal/`.

## Key findings and evidence

- startCommitted. [S] `navier/runtime/start.ts:83-112`
- startTurn pending arm signal. [S] `navier/runtime/start.ts:130-179`
- edit start. [S] `navier/runtime/revise.ts:189-197`
- replay retry start. [S] `navier/runtime/revise.ts:224-246`
- retry start. [S] `navier/runtime/revise.ts:332-339`
- promoted start. [S] `navier/runtime/activities.ts:163-179`
- decide restart. [S] `navier/runtime/decide.ts:514-533`
- stop signal. [S] `navier/runtime/stop.ts:129-139`
- awaitTurn. [S] `navier/sdk/turn.ts:180-225`
- worker composition. [S] `navier/worker.ts:142-189`
- API composition. [S] `navier/api.ts:104-130`
- SDK runtime connect. [S] `navier/sdk/runtime.ts:130-160`
- chat handler start and stop. [S] `navier/api/routes/chat/handler.ts:95-120`

## Limits and unknowns

Tests not in the zip.

## Research recommendation

**Recommendation:** adopt — one interface with six operations; schedules become worker-internal per runner.
**Why / consequences:** Schedules are a runner concern, not a domain call.
**Do not copy:** Cite only. Notes describe and cite; no product code enters this repository.

## Technical references

### File map

#### P0 — read first

| File / source | What question it helps verify |
|---------------|-------------------------------|
| `navier/runtime/start.ts` | start |
| `navier/runtime/stop.ts` | stop |

#### P1 — implementation detail

| File / source | When to open it |
|---------------|-----------------|
| `navier/sdk/turn.ts` | await |

#### Skip

| Path / source | Why it is outside this question |
|---------------|---------------------------------|
| `navier/temporal/probe.ts` | probe |
