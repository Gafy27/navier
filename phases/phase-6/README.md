# Phase 6 — Operations

Specs and tickets sit here. `prompts/` holds design and implementation session prompts, `history/` holds retired or absorbed docs, and `indexing/` holds the research notes for this phase.

Research index: [`indexing/README.md`](indexing/README.md).

**Objective:** Run the DBOS worker as a long-lived process outside Vercel with stable executor identity, bounded queues, OpenTelemetry, a failure-mode table, and load and chaos tests that close the latency questions left by phase 2.

**Status:** designing (2026-11-04). All 5 units have BINDING architecture and program specs and a ticket anexo. Next: P6.1 first; P6.2 and P6.3 together; P6.4; P6.5 last.

## Boundaries

- Worker outside Vercel; API uses only the DBOS client or SQL (owner decision 4).
- No Conductor dependency for correctness; Conductor, if used, is metadata-only ([P7.2](../phase-7/PHASE7_P7.2_SECURITY_REVIEW.md)).
- Operations reuse `process/run.ts` and `process/health.ts`; no second process framework.

| File | Role |
|------|------|
| `PHASE6_OVERVIEW.md` | Phase requirements note: condensed source docs, unit map, cross-unit interfaces. Not a binding spec |
| `PHASE6_P6.1_WORKER_DEPLOYMENT.md` | **BINDING through pass 3, unresolved R3-F1, R3-F2** (2026-11-04) P6.1 Worker deployment and lifecycle — D1–D6; N slots with executorID `navier-worker-<ordinal>`; applicationVersion = build SHA; blue-green by version; DBOS launch/shutdown wrapped as a runProcess resource with `/readyz` probe; migrate + provision as a pre-deploy job; orphan-slot recovery is an operator action |
| `PHASE6_P6.1_WORKER_DEPLOYMENT_PROGRAM.md` | **BINDING through pass 1** (2026-11-04) P6.1 landing — PD1–PD3; `src/runner/dbos/resource.ts` (launch/probe/shutdown); `src/runner/dbos/identity.ts` (executor ID from `POD_NAME` ordinal); `scripts/deploy/pre-deploy.ts`; `scripts/ops/drain-slot.ts` |
| `PHASE6_P6.1_WORKER_DEPLOYMENT_TICKETS.md` | P6.1 tickets 1–4 — `1 -> 2 -> 3 -> 4`; 1 `src/runner/dbos`, 2 `src/runner/dbos`, 3 `scripts`, 4 remove complexity + full test. Prereq: P1.4, P3.4. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE6_P6.2_SCALING_QUEUES.md` | **BINDING through pass 2** (2026-11-04) P6.2 Queues, partitions and sizing — D1–D4; `turns` queue: partitionConcurrency 1 (thread serial), workerConcurrency = pod sizing (default 20), no global limit; `maintenance` queue concurrency 1 for sweeps; registerQueue conflict = update_if_latest_version |
| `PHASE6_P6.2_SCALING_QUEUES_PROGRAM.md` | **BINDING through pass 1** (2026-11-04) P6.2 landing — PD1; `src/runner/dbos/queues.ts` registering both queues from config |
| `PHASE6_P6.2_SCALING_QUEUES_TICKETS.md` | P6.2 tickets 1–2 — `1 -> 2`; 1 `src/runner/dbos`, 2 remove complexity + full test. Prereq: P2.1. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE6_P6.3_OBSERVABILITY.md` | **BINDING through pass 1** (2026-11-04) P6.3 Traces, metrics and alerts — D1–D4; enableOTLP with Navier collector; workflowAttributes {orgId, traceId} (ids only); metrics from SQL on dbos.workflow_status (queue lag, PENDING by executor, MAX_RECOVERY_ATTEMPTS_EXCEEDED, ERROR); alerts with thresholds; Temporal interceptors deleted at retirement |
| `PHASE6_P6.3_OBSERVABILITY_PROGRAM.md` | **BINDING through pass 2** (2026-11-04) P6.3 landing — PD1; `src/runner/dbos/metrics.ts` queries; OTLP config in `runner/config.ts` |
| `PHASE6_P6.3_OBSERVABILITY_TICKETS.md` | P6.3 tickets 1–3 — `1 -> 2 -> 3`; 1 `src/runner`, 2 `src/runner/dbos`, 3 remove complexity + full test. Prereq: P6.1. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE6_P6.4_FAILURE_MODES.md` | **BINDING through pass 2** (2026-11-04) P6.4 Failure-mode table — D1–D2; 10 failure modes with detection and response; no reaper; DBOS recovery + audit sweep + operator actions |
| `PHASE6_P6.4_FAILURE_MODES_PROGRAM.md` | **BINDING through pass 1** (2026-11-04) P6.4 landing — PD1; `docs/runner/failure-modes.md` |
| `PHASE6_P6.4_FAILURE_MODES_TICKETS.md` | P6.4 tickets 1–2 — `1 -> 2`; 1 `docs`, 2 remove complexity + full test. Prereq: P6.3. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE6_P6.5_LOAD_CHAOS.md` | **BINDING through pass 2** (2026-11-04) P6.5 Load and chaos tests — D1–D3; L1–L3 load (500 concurrent turns, 50 stop/s, 2k SSE clients); C1–C6 chaos (kill -9 mid-step, PG failover, slot loss, resume on PENDING, listener drop, bad deploy); pass thresholds |
| `PHASE6_P6.5_LOAD_CHAOS_PROGRAM.md` | **BINDING through pass 1** (2026-11-04) P6.5 landing — PD1–PD2; `test/load/*.ts` (k6 or node driver) and `test/chaos/*.sh` |
| `PHASE6_P6.5_LOAD_CHAOS_TICKETS.md` | P6.5 tickets 1–3 — `1 -> 2 -> 3`; 1 `test/load`, 2 `test/chaos`, 3 remove complexity + full test. Prereq: P6.1–P6.3. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `prompts/PHASE6_DESIGN_SESSIONS.md` | Paste-ready design-session blocks per unit and pass; produced the specs and anexos above |
| `reviews/PHASE6_P6.1_WORKER_DEPLOYMENT_REVIEW.md` | P6.1 architecture review, 3 round(s), final VERDICT not-ready; unresolved R3-F1, R3-F2 |
| `reviews/PHASE6_P6.1_WORKER_DEPLOYMENT_PROGRAM_REVIEW.md` | P6.1 program review, 1 round(s), final VERDICT ready |
| `reviews/PHASE6_P6.2_SCALING_QUEUES_REVIEW.md` | P6.2 architecture review, 2 round(s), final VERDICT ready |
| `reviews/PHASE6_P6.2_SCALING_QUEUES_PROGRAM_REVIEW.md` | P6.2 program review, 1 round(s), final VERDICT ready |
| `reviews/PHASE6_P6.3_OBSERVABILITY_REVIEW.md` | P6.3 architecture review, 1 round(s), final VERDICT ready |
| `reviews/PHASE6_P6.3_OBSERVABILITY_PROGRAM_REVIEW.md` | P6.3 program review, 2 round(s), final VERDICT ready |
| `reviews/PHASE6_P6.4_FAILURE_MODES_REVIEW.md` | P6.4 architecture review, 2 round(s), final VERDICT ready |
| `reviews/PHASE6_P6.4_FAILURE_MODES_PROGRAM_REVIEW.md` | P6.4 program review, 1 round(s), final VERDICT ready |
| `reviews/PHASE6_P6.5_LOAD_CHAOS_REVIEW.md` | P6.5 architecture review, 2 round(s), final VERDICT ready |
| `reviews/PHASE6_P6.5_LOAD_CHAOS_PROGRAM_REVIEW.md` | P6.5 program review, 1 round(s), final VERDICT ready |

## Gates for owner

Gate picks in this phase were delegated to the designer (request pt151u); the owner has **not** answered them. These are the most consequential; reply with the id and A/B (or a named third) to overturn one.

- [P6.1](PHASE6_P6.1_WORKER_DEPLOYMENT.md) D2 — stable executor IDs per worker slot (StatefulSet-style ordinal) so a restarted slot recovers its own workflows (A) vs DBOS Conductor-driven recovery (B).
- [P6.2](PHASE6_P6.2_SCALING_QUEUES.md) D1 — one `turns` queue partitioned by thread with `partitionConcurrency: 1` and `workerConcurrency` sized per pod (A) vs one queue per org (B).
- [P6.3](PHASE6_P6.3_OBSERVABILITY.md) D1 — DBOS OTLP traces with `workflowAttributes` {org, traceId} plus Navier pino logs unchanged (A) vs a custom tracing wrapper (B).
