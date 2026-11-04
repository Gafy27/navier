# P6.2 Queues, partitions and sizing: one `turns` queue, partition = thread id, partitionConcurrency 1; workerConcurrency per pod; schedules on their own queue

Status: BINDING through pass 2
Depends on: product contract [`README.md`](../../README.md); [P2.1](../phase-2/PHASE2_P2.1_TURN_WORKFLOW.md), [P6.1](PHASE6_P6.1_WORKER_DEPLOYMENT.md).
Program: [`PHASE6_P6.2_SCALING_QUEUES_PROGRAM.md`](PHASE6_P6.2_SCALING_QUEUES_PROGRAM.md). Review: [`reviews/PHASE6_P6.2_SCALING_QUEUES_REVIEW.md`](reviews/PHASE6_P6.2_SCALING_QUEUES_REVIEW.md).
Sources: `dbos/dist/src/wfqueue.d.ts:25-48`, `dbos/dist/src/system_database.d.ts:150-162`.

## Design explained

**Turns (D1).** Every turn is enqueued on `turns` with `queuePartitionKey = threadId` (`dbos/dist/src/system_database.d.ts:150-162`). `partitionConcurrency: 1` keeps one turn per thread running, matching today's per-thread lock ([P0.4](../phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) A17 kept as a second guard). `workerConcurrency` bounds per-pod load (default 20; sized by [P6.5](PHASE6_P6.5_LOAD_CHAOS.md)).

**Maintenance (D2).** Audit and stream sweeps ([P3.3](../phase-3/PHASE3_P3.3_SCHEDULES_SWEEPS.md)) run on `maintenance` with `globalConcurrency: 1`.

**Config conflicts (D3).** Queues are registered with `update_if_latest_version` so an old version in a blue-green overlap does not overwrite newer limits (`dbos/dist/src/wfqueue.d.ts:25-60`).

**Fairness (D4).** No per-org limit initially; an org rate limit (`partitionRateLimit` on a second-level queue) is a later option if one org floods.

## Context and scope

Today serialization is the thread lock.

## Goals and non-goals

**Goals**

- **G1 —** Thread-serial; bounded pods.

**Non-goals**

- Per-org fairness now.

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| turns | partitioned | thread serial | DBOS |
| maintenance | concurrency 1 | sweeps | [P3.3](../phase-3/PHASE3_P3.3_SCHEDULES_SWEEPS.md) |
| Conflicts | latest version wins | deploys | [P6.1](PHASE6_P6.1_WORKER_DEPLOYMENT.md) |

## Decisions and rationale

### D1 — turns: thread partition, concurrency 1

workerConcurrency per pod. [pass 2]

### D2 — maintenance queue

Serial sweeps. [pass 1]

### D3 — update_if_latest_version

Blue-green safe. [pass 1]

### D4 — No org fairness yet

Option noted. [pass 1]

## Relevant cross-cutting concerns

Queue lag metric ([P6.3](PHASE6_P6.3_OBSERVABILITY.md)).

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2, D3, D4 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE6_P6.2_SCALING_QUEUES_REVIEW.md#round-1) — VERDICT fix-then-ready. | D1: queue per org — unbounded queue count; D4: org partition — breaks thread serial | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | D1 | Review fixes for R1-F1 ([round 1](reviews/PHASE6_P6.2_SCALING_QUEUES_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE6_P6.2_SCALING_QUEUES_REVIEW.md#round-2) — VERDICT ready. | — | [review round 1](reviews/PHASE6_P6.2_SCALING_QUEUES_REVIEW.md#round-1); BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
