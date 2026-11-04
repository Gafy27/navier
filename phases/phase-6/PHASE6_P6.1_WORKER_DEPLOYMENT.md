# P6.1 Worker deployment and lifecycle: long-lived pods outside Vercel; stable executor ID per slot; pinned applicationVersion; DBOS as a runProcess resource

Status: BINDING through pass 3 — unresolved: R3-F1, R3-F2; accepted by owner request (pt151u) 2026-11-04
Depends on: product contract [`README.md`](../../README.md); [P1.4](../phase-1/PHASE1_P1.4_RUNNER_CONFIG.md), [P3.1](../phase-3/PHASE3_P3.1_CLAIMS_RECOVERY.md), [P3.4](../phase-3/PHASE3_P3.4_SCHEMA_MIGRATIONS.md).
Program: [`PHASE6_P6.1_WORKER_DEPLOYMENT_PROGRAM.md`](PHASE6_P6.1_WORKER_DEPLOYMENT_PROGRAM.md). Review: [`reviews/PHASE6_P6.1_WORKER_DEPLOYMENT_REVIEW.md`](reviews/PHASE6_P6.1_WORKER_DEPLOYMENT_REVIEW.md).
Sources: research [dbos-ops-surface](indexing/dbos-ops-surface.md), [navier-process-lifecycle](indexing/navier-process-lifecycle.md).

## Design explained

**Where (D1).** Workers run as long-lived containers (Kubernetes StatefulSet or equivalent) outside Vercel (`navier/process/run.ts:34-110`). The API on Vercel only uses the DBOS client / SQL ([P1.4](../phase-1/PHASE1_P1.4_RUNNER_CONFIG.md)).

**Identity (D2).** Each slot has a stable `executorID` (`navier-worker-<ordinal>`) (`dbos/dist/src/dbos-executor.d.ts:16-70`). A restarted slot recovers the PENDING workflows recorded under its ID on launch. Scaling down removes the highest ordinals only after their drain (D5).

**Version (D3).** `applicationVersion` is the build SHA. A deploy brings up a new set of slots with the new version; old slots finish their workflows (they only recover their own version) and are removed when `listWorkflows({executorId, status: PENDING})` is empty (`dbos/dist/src/workflow.d.ts:101-130`). Code changes inside a workflow body that must apply to in-flight workflows use `DBOS.patch` ([P2.1](../phase-2/PHASE2_P2.1_TURN_WORKFLOW.md)).

**Lifecycle (D4).** DBOS is a tracked resource: open = `DBOS.launch()`, probe = system-DB `select 1` with `PROBE_TIMEOUT_MS`, close = `DBOS.shutdown({workflowCompletionTimeoutMS: SHUTDOWN_TIMEOUT_MS − 5 s})` (`dbos/dist/src/dbos.d.ts:236-252`, `navier/process/health.ts:51-80`). Workflows not finished in time are recovered by the same slot on restart.

**Scale-down (D5).** Before removing slot k: stop routing (`listenQueues` excludes `turns` on k [U: per-executor listen config]), wait for zero PENDING on k, then delete. If slot k is lost permanently with PENDING workflows, an operator runs `resumeWorkflow` on each from a maintenance job (semantics on PENDING [U]).

**Deploy job (D6).** `DBOS.migrate` and authz-engine `provision()` run as a one-shot pre-deploy job with the migration role ([P3.4](../phase-3/PHASE3_P3.4_SCHEMA_MIGRATIONS.md) D3, [P4.3](../phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ.md)).

## Context and scope

Owner decision 4.

## Goals and non-goals

**Goals**

- **G1 —** No lost or duplicated turns across restarts, deploys, scale.

**Non-goals**

- Autoscaling policy beyond sizing ([P6.2](PHASE6_P6.2_SCALING_QUEUES.md)).

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Slots | stable executor IDs | own recovery | DBOS |
| Versions | build SHA | blue-green | [P2.1](../phase-2/PHASE2_P2.1_TURN_WORKFLOW.md) |
| Resource | launch/probe/shutdown | runProcess | `navier/process/run.ts:34-110` |
| Deploy job | migrate + provision | pre-deploy | [P3.4](../phase-3/PHASE3_P3.4_SCHEMA_MIGRATIONS.md) |

## Decisions and rationale

### D1 — Long-lived pods outside Vercel

StatefulSet-like. [pass 1]

### D2 — Stable executor ID per slot

Own recovery. [pass 2]

### D3 — applicationVersion = SHA; blue-green

Old slots drain. [pass 1]

### D4 — DBOS as a runProcess resource

Probe and bounded shutdown. [pass 3]

### D5 — Scale-down drains the slot

Orphan slot = operator resume. [pass 2]

### D6 — Pre-deploy migrate + provision job

Migration role only. [pass 1]

## Unresolved questions and blockers

Open review findings at BINDING: R3-F1, R3-F2 — see [`reviews/PHASE6_P6.1_WORKER_DEPLOYMENT_REVIEW.md`](reviews/PHASE6_P6.1_WORKER_DEPLOYMENT_REVIEW.md). The owner request (pt151u) authorizes BINDING after three rounds; these items keep their owners in the review Response tables.

## Relevant cross-cutting concerns

Secrets via env; never in DBOS inputs.

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2, D3, D4, D6 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE6_P6.1_WORKER_DEPLOYMENT_REVIEW.md#round-1) — VERDICT not-ready. | D2: random executor IDs — crashed pods are never recovered without Conductor; D3: in-place rolling with one version — in-flight replay mismatch | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | draft (superseded by next pass) | D2 | Review fixes for R1-F1 ([round 1](reviews/PHASE6_P6.1_WORKER_DEPLOYMENT_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE6_P6.1_WORKER_DEPLOYMENT_REVIEW.md#round-2) — VERDICT not-ready. | — | [review round 1](reviews/PHASE6_P6.1_WORKER_DEPLOYMENT_REVIEW.md#round-1); new D5 delegated to designer (pt151u), recommend-A |
| 3 | 2026-11-04 | BINDING | D4 | Review fixes for R2-F1 ([round 2](reviews/PHASE6_P6.1_WORKER_DEPLOYMENT_REVIEW.md#round-2)). Reviewed in [round 3](reviews/PHASE6_P6.1_WORKER_DEPLOYMENT_REVIEW.md#round-3) — VERDICT not-ready. | — | [review round 2](reviews/PHASE6_P6.1_WORKER_DEPLOYMENT_REVIEW.md#round-2); BINDING by owner request (pt151u) after round 3 not-ready — unresolved R3-F1, R3-F2 accepted as recorded in the review file |
