# P3.1 Claims and recovery off the DBOS path — program design

Status: BINDING through pass 1
Architecture: [`PHASE3_P3.1_CLAIMS_RECOVERY.md`](PHASE3_P3.1_CLAIMS_RECOVERY.md) (BINDING through pass 2).
Depends on: [P3.1](PHASE3_P3.1_CLAIMS_RECOVERY.md) architecture.
Tickets: [`PHASE3_P3.1_CLAIMS_RECOVERY_TICKETS.md`](PHASE3_P3.1_CLAIMS_RECOVERY_TICKETS.md). Review: [`reviews/PHASE3_P3.1_CLAIMS_RECOVERY_PROGRAM_REVIEW.md`](reviews/PHASE3_P3.1_CLAIMS_RECOVERY_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Architecture rules mapped to owners | [Architecture rules mapped to owners](#architecture-rules-mapped-to-owners) |
| PD1 | [Edits only](#pd1--edits-only) |
| PD2 | [Per-version check in the sweep](#pd2--per-version-check-in-the-sweep) |

## Implementation explained

Two small edits and a config annotation (PD1). The per-version check lives in the sweep ([P3.3](PHASE3_P3.3_SCHEDULES_SWEEPS.md)) (PD2).

## Architecture rules mapped to owners

| Architecture ids | Owning file / operation | Enforcement or delegation |
|------------------|-------------------------|---------------------------|
| D1 | `src/runner/dbos/steps.ts` | no guard passed |
| D2 | `workflow.ts` | `maxRecoveryAttempts: 3` |
| D4 | `src/config.ts` | moved under Temporal block |
| D5 | `agents/publish.ts` | warn on > 3 |

[pass 1]

## Landing decisions

### PD1 — Edits only

No new module. [pass 1]

### PD2 — Per-version check in the sweep

One place reads `recoveryAttempts`. [pass 1]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | PD1, PD2, owners | Initial program spec. Reviewed in [round 1](reviews/PHASE3_P3.1_CLAIMS_RECOVERY_PROGRAM_REVIEW.md#round-1) — VERDICT ready. | PD2: check in loadTurn — the crashing turn may never reach it | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
