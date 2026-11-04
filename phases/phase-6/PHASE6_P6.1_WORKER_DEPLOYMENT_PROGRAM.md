# P6.1 Worker deployment and lifecycle — program design

Status: BINDING through pass 1
Architecture: [`PHASE6_P6.1_WORKER_DEPLOYMENT.md`](PHASE6_P6.1_WORKER_DEPLOYMENT.md) (BINDING through pass 3 — unresolved: R3-F1, R3-F2; accepted by owner request (pt151u) 2026-11-04).
Depends on: [P6.1](PHASE6_P6.1_WORKER_DEPLOYMENT.md) architecture.
Tickets: [`PHASE6_P6.1_WORKER_DEPLOYMENT_TICKETS.md`](PHASE6_P6.1_WORKER_DEPLOYMENT_TICKETS.md). Review: [`reviews/PHASE6_P6.1_WORKER_DEPLOYMENT_PROGRAM_REVIEW.md`](reviews/PHASE6_P6.1_WORKER_DEPLOYMENT_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Architecture rules mapped to owners | [Architecture rules mapped to owners](#architecture-rules-mapped-to-owners) |
| PD1 | [Executor ID from WORKER_SLOT](#pd1--executor-id-from-workerslot) |
| PD2 | [Resource wrapper](#pd2--resource-wrapper) |
| PD3 | [Drain-slot script](#pd3--drain-slot-script) |

## Implementation explained

Executor ID from env `WORKER_SLOT` (PD1); resource wraps launch and shutdown (PD2); drain-slot script lists PENDING by executor and waits (PD3).

## Architecture rules mapped to owners

| Architecture ids | Owning file / operation | Enforcement or delegation |
|------------------|-------------------------|---------------------------|
| D2 | `runner/dbos/identity.ts` | ID |
| D4 | `runner/dbos/resource.ts` | resource |
| D5 | `scripts/ops/drain-slot.ts` | drain |
| D6 | `scripts/deploy/pre-deploy.ts` | job |

[pass 1]

## Landing decisions

### PD1 — Executor ID from WORKER_SLOT

Boot refuses missing. [pass 1]

### PD2 — Resource wrapper

Probe on system DB. [pass 1]

### PD3 — Drain-slot script

Exit 0 at zero PENDING. [pass 1]

## Unresolved questions and blockers

Architecture carries open findings R3-F1, R3-F2; this program does not resolve them and names the ticket that must stop and report if it hits one.

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | PD1, PD2, PD3, owners | Initial program spec. Reviewed in [round 1](reviews/PHASE6_P6.1_WORKER_DEPLOYMENT_PROGRAM_REVIEW.md#round-1) — VERDICT ready. | PD1: hostname — changes on reschedule in Deployments | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
