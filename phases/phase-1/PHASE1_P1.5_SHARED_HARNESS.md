# P1.5 Shared runner conformance harness: one scripted suite, asserted on rows, run on both runners

Status: BINDING through pass 2
Depends on: product contract [`README.md`](../../README.md); [P1.1](PHASE1_P1.1_RUNNER_INTERFACE.md)–[P1.4](PHASE1_P1.4_RUNNER_CONFIG.md).
Program: [`PHASE1_P1.5_SHARED_HARNESS_PROGRAM.md`](PHASE1_P1.5_SHARED_HARNESS_PROGRAM.md). Review: [`reviews/PHASE1_P1.5_SHARED_HARNESS_REVIEW.md`](reviews/PHASE1_P1.5_SHARED_HARNESS_REVIEW.md).
Sources: `navier/llm/types.ts:81-88`; `navier/temporal/replay.test.ts:1-33`.

## Design explained

A scenario is a script of model responses and tool results plus actions (stop, decide, post-while-running). The harness drives a turn through the public domain functions and asserts **only rows** — message statuses, steps, actions, decisions, deltas count — never runner internals, so one suite proves both runners (D1, D2).

Scenarios (D3): S1 plain answer; S2 one tool call; S3 two parallel tool calls; S4 approval approved; S5 approval denied; S6 approval expired; S7 cancel during model stream; S8 interrupt during tool call; S9 graceful stop by pending message → promoted turn; S10 model refused / failed; S11 `maxSteps` reached; S12 edit and retry.

The fake `ModelAdapter` implements the unchanged interface (`navier/llm/types.ts:81-88`) and streams scripted chunks (D4). The Temporal leg runs against a local dev server [U whether Navier already has `@temporalio/testing`]; the DBOS leg runs `DBOS.launch()` against a disposable Postgres with Navier migrations (D5). Kill/recovery scenarios are DBOS-only ([P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md), [P6.5](../phase-6/PHASE6_P6.5_LOAD_CHAOS.md)).

## Context and scope

Replay fixtures are not in the zip; the replay test stays with the frozen adapter.

## Goals and non-goals

**Goals**

- **G1 —** Same rows on both runners for S1–S12.
- **G2 —** Fast enough for every PR (< 3 min) [U].

**Non-goals**

- Load ([P6.5](../phase-6/PHASE6_P6.5_LOAD_CHAOS.md)).

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Fakes | model, tools | scripts | ModelAdapter |
| Scenarios | S1–S12 | row expectations | domain API |
| Legs | Temporal, DBOS | same suite | [P1.4](PHASE1_P1.4_RUNNER_CONFIG.md) config |

## Decisions and rationale

### D1 — One suite, both runners

Parameterised by `RUNNER`. [pass 1]

### D2 — Rows only

No runner internals asserted. [pass 1]

### D3 — Twelve scenarios

S1–S12. [pass 2]

### D4 — Scripted ModelAdapter

Unchanged interface. [pass 1]

### D5 — Legs

Temporal dev server; DBOS on disposable Postgres. [pass 1]

## Relevant cross-cutting concerns

Tests never touch shared data (profile testing).

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2, D3, D4, D5 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE1_P1.5_SHARED_HARNESS_REVIEW.md#round-1) — VERDICT fix-then-ready. | D1: per-runner suites — drift; D2: assert workflow history — runner-specific | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | D3 | Review fixes for R1-F1 ([round 1](reviews/PHASE1_P1.5_SHARED_HARNESS_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE1_P1.5_SHARED_HARNESS_REVIEW.md#round-2) — VERDICT ready. | — | [review round 1](reviews/PHASE1_P1.5_SHARED_HARNESS_REVIEW.md#round-1); BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
