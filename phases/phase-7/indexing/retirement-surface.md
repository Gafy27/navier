# What retires with Temporal

**Kind:** module
**Source:** `/workspace/attach/navier/src` (Navier src (navier.zip), owner code, read-only, pin `zip 2026-11-04`). Cites below are `tree/path:line` relative to each root.
**Concerns:** P7.1, P7.4
**Verdict axis:** live
**Status:** ready

**Question:** Which files and tables exist only for the Temporal runner?

## Answer in plain language

`temporal/` (client, worker, probe, attributes, trace, interceptors, replay and its test), `workflows.ts`, `activities.ts` and `runtime/activities.ts` serve only Temporal; the worker entry wires them. `step_claim` and `recovery` tables back the Temporal at-most-once and reaper restart logic; DBOS step records replace both ([P0.4](../../phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) A8, A12). The replay test checks history determinism, which DBOS does not need (it replays from recorded step outputs).

## Why it matters for this project

Defines P7.4's deletion list and what P7.1 must re-cover.

## How it works

Read the temporal folder, worker entry, and tables.

## Key findings and evidence

- Replay harness. [S] `navier/temporal/replay.ts:1-45`
- Replay test. [S] `navier/temporal/replay.test.ts:1-33`
- Worker wiring. [S] `navier/worker.ts:1-30`
- Temporal worker. [S] `navier/temporal/worker.ts:46-92`
- step_claim and recovery tables. [S] `navier/runtime/tables.ts:131-151`
- Their migrations. [S] `navier/runtime/migrations/04_0010_step_claim.ts:1-10`

## Limits and unknowns

Tests outside `src` not read.

## Research recommendation

**Recommendation:** adopt — delete list in P7.4.
**Why / consequences:** Keeping dead code violates "simplify to the minimum".
**Do not copy:** Delete before sign-off. Notes describe and cite; no product code enters this repository.

## Technical references

### File map

#### P0 — read first

| File / source | What question it helps verify |
|---------------|-------------------------------|
| `navier/temporal/replay.ts` | replay |

#### P1 — implementation detail

| File / source | When to open it |
|---------------|-----------------|
| `navier/runtime/tables.ts` | tables |
