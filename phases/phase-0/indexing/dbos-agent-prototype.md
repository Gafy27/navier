# Owner DBOS agent prototype

**Kind:** module
**Source:** `/workspace/dbos-agent` (owner DBOS agent prototype (verified on Neon 2026-10-28), owner prototype, pin `no-vcs`). Cites below are `tree/path:line` relative to each root.
**Concerns:** P0.3 evidence, P2.4 approval
**Verdict axis:** live
**Status:** ready

**Question:** What did the owner's prototype prove about DBOS agents?

## Answer in plain language

A workflow loops model steps; a tool that needs approval writes a row, publishes an event, then waits on `recv("approval")` with a timeout; the decision arrives with `send`. The worker is a plain long-lived process that calls `DBOS.launch()`. The README records a `kill -9` recovery run on Neon.

## Why it matters for this project

The recv-wait pattern removes the "end workflow on pause, restart on decide" dance Navier does today.

## How it works

Read `src/agent.ts` and `src/worker.ts`.

## Key findings and evidence

- Model step as runStep. [S] `proto/src/agent.ts:60-96`
- Approval wait via recv with timeout. [S] `proto/src/agent.ts:104-124`
- Workflow registration. [S] `proto/src/agent.ts:133`
- Worker launch. [S] `proto/src/worker.ts:1-10`

## Limits and unknowns

Prototype uses the AI SDK and its own schema; only the runner pattern transfers.

## Research recommendation

**Recommendation:** adopt — recv-wait pause and event publication; reject its AI SDK use (owner decision 2).
**Why / consequences:** Navier keeps its ModelAdapter.
**Do not copy:** Prototype code is owner work; cite. Notes describe and cite; no product code enters this repository.

## Technical references

### File map

#### P0 — read first

| File / source | What question it helps verify |
|---------------|-------------------------------|
| `proto/src/agent.ts` | pattern |

#### P1 — implementation detail

| File / source | When to open it |
|---------------|-----------------|
| `proto/src/worker.ts` | worker |

#### Skip

| Path / source | Why it is outside this question |
|---------------|---------------------------------|
| `proto/src/hub-tools.ts` | demo tools |
