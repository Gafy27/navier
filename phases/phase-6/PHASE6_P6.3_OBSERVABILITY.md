# P6.3 Traces, metrics and alerts: DBOS OTLP traces + workflowAttributes; pino unchanged; queue-lag, recovery and dead-letter alerts

Status: BINDING through pass 1
Depends on: product contract [`README.md`](../../README.md); [P6.1](PHASE6_P6.1_WORKER_DEPLOYMENT.md), [P3.1](../phase-3/PHASE3_P3.1_CLAIMS_RECOVERY.md).
Program: [`PHASE6_P6.3_OBSERVABILITY_PROGRAM.md`](PHASE6_P6.3_OBSERVABILITY_PROGRAM.md). Review: [`reviews/PHASE6_P6.3_OBSERVABILITY_REVIEW.md`](reviews/PHASE6_P6.3_OBSERVABILITY_REVIEW.md).
Sources: `dbos/dist/src/dbos-executor.d.ts:16-70`, `navier/log.ts:1-78`.

## Design explained

**Traces (D1).** `enableOTLP: true`, `otlpTracesEndpoints` = Navier's collector (`dbos/dist/src/dbos-executor.d.ts:16-70`). DBOS logs stay off OTLP; Navier keeps pino (`navier/log.ts:1-78`). The API passes `traceId` in `workflowAttributes` at enqueue so the turn's spans join the request ([P2.1](../phase-2/PHASE2_P2.1_TURN_WORKFLOW.md)).

**Metrics (D2).** A metrics job queries the system tables every 30 s: ENQUEUED age p95 (queue lag), PENDING per executor, count of MAX_RECOVERY_ATTEMPTS_EXCEEDED and ERROR in 15 min, drain count ([P5.1](../phase-5/PHASE5_P5.1_DRAIN_DUALRUN.md)), authz diff count ([P4.4](../phase-4/PHASE4_P4.4_AUTHZ_CUTOVER.md)).

**Alerts (D3).** Queue lag p95 > 30 s for 5 min; any MAX_RECOVERY_ATTEMPTS_EXCEEDED; PENDING on an executor with no live pod > 2 min; system-DB probe failing; audit sweep closing > 0.1 % of turns.

**Payload hygiene (D4).** Attributes are ids and enums only (L2 from [P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md)).

## Context and scope

Temporal interceptors provide attributes today ([P0.4](../phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) A20).

## Goals and non-goals

**Goals**

- **G1 —** Request-to-step trace; actionable alerts.

**Non-goals**

- Dashboards design.

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Traces | OTLP | collector | DBOS |
| Metrics | SQL job | gauges | system tables |
| Alerts | thresholds | on-call | [P6.4](PHASE6_P6.4_FAILURE_MODES.md) |

## Decisions and rationale

### D1 — DBOS OTLP traces + attributes

pino unchanged. [pass 1]

### D2 — Metrics from system tables

30 s job. [pass 1]

### D3 — Alert thresholds

As listed. [pass 1]

### D4 — Ids-only attributes

L2. [pass 1]

## Relevant cross-cutting concerns

No content in spans.

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | D1, D2, D3, D4 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE6_P6.3_OBSERVABILITY_REVIEW.md#round-1) — VERDICT ready. | D1: custom wrapper — duplicates DBOS spans | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
