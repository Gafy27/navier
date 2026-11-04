# P6.5 Load and chaos tests: measured abort latency, NOTIFY fan-out, kill -9, failover, orphan slot; closes P2.3 and P6.1 deferred items

Status: BINDING through pass 2
Depends on: product contract [`README.md`](../../README.md); [P6.1](PHASE6_P6.1_WORKER_DEPLOYMENT.md)–[P6.4](PHASE6_P6.4_FAILURE_MODES.md), [P2.3](../phase-2/PHASE2_P2.3_STOP_INTERRUPT.md).
Program: [`PHASE6_P6.5_LOAD_CHAOS_PROGRAM.md`](PHASE6_P6.5_LOAD_CHAOS_PROGRAM.md). Review: [`reviews/PHASE6_P6.5_LOAD_CHAOS_REVIEW.md`](reviews/PHASE6_P6.5_LOAD_CHAOS_REVIEW.md).
Sources: [P2.3](../phase-2/PHASE2_P2.3_STOP_INTERRUPT.md) deferred findings.

## Design explained

**Load (D1).** L1: 500 concurrent turns with a fake model at 2 s/step across 20 slots — queue lag p95 < 5 s. L2: 50 stops/s — stop-to-abort p95 < 1 s, p99 < 3 s (closes [P2.3](../phase-2/PHASE2_P2.3_STOP_INTERRUPT.md) R3-F1). L3: 2,000 SSE clients and 500 turns — NOTIFY payload rate and listener CPU recorded; pass if delta p95 < 300 ms (closes [P2.3](../phase-2/PHASE2_P2.3_STOP_INTERRUPT.md) R3-F2).

**Chaos (D2).** C1 kill -9 a slot mid-tool-call → no duplicate side effect, turn finishes. C2 Postgres failover → all turns finish or end `errored` with reason. C3 lose a slot → restart with its executor ID recovers. C4 `resumeWorkflow` on PENDING of a dead executor → record behaviour (closes [P6.1](PHASE6_P6.1_WORKER_DEPLOYMENT.md) R3-F1 one way or the other). C5 drop LISTEN → SSE recovers by replay. C6 deploy a build with a non-patched workflow change → ERROR confined to the new version.

**Environment (D3).** Staging with production-sized Postgres; fake model and tools from the harness ([P1.5](../phase-1/PHASE1_P1.5_SHARED_HARNESS.md)).

## Context and scope

Phase 2 left latency and fan-out unmeasured.

## Goals and non-goals

**Goals**

- **G1 —** Numbers, not assumptions.

**Non-goals**

- Real model cost tests.

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Load | L1–L3 | thresholds | harness |
| Chaos | C1–C6 | behaviour | [P6.4](PHASE6_P6.4_FAILURE_MODES.md) |
| Env | staging | fakes | [P1.5](../phase-1/PHASE1_P1.5_SHARED_HARNESS.md) |

## Decisions and rationale

### D1 — Load tests with thresholds

L1–L3. [pass 1]

### D2 — Chaos tests

C1–C6. [pass 2]

### D3 — Staging with fakes

Harness. [pass 1]

## Relevant cross-cutting concerns

Results recorded per release.

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2, D3 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE6_P6.5_LOAD_CHAOS_REVIEW.md#round-1) — VERDICT fix-then-ready. | D1: production canary only — no controlled stop rate | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | D2 | Review fixes for R1-F1 ([round 1](reviews/PHASE6_P6.5_LOAD_CHAOS_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE6_P6.5_LOAD_CHAOS_REVIEW.md#round-2) — VERDICT ready. | — | [review round 1](reviews/PHASE6_P6.5_LOAD_CHAOS_REVIEW.md#round-1); BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
