# P7.3 Open-source readiness — program design

Status: BINDING through pass 1
Architecture: [`PHASE7_P7.3_OSS_READINESS.md`](PHASE7_P7.3_OSS_READINESS.md) (BINDING through pass 3).
Depends on: [P7.3](PHASE7_P7.3_OSS_READINESS.md) architecture.
Tickets: [`PHASE7_P7.3_OSS_READINESS_TICKETS.md`](PHASE7_P7.3_OSS_READINESS_TICKETS.md). Review: [`reviews/PHASE7_P7.3_OSS_READINESS_PROGRAM_REVIEW.md`](reviews/PHASE7_P7.3_OSS_READINESS_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Program layout and construction | [Program layout and construction](#program-layout-and-construction) |
| PD1 | [Conformance package](#pd1--conformance-package) |
| PD2 | [Seed command](#pd2--seed-command) |
| PD3 | [Quickstart CI](#pd3--quickstart-ci) |

## Implementation explained

Conformance suite as a package other adapters import (PD1); seed command (PD2); CI job runs the quickstart in a container (PD3).

## Program layout and construction

```text
docs/{README,quickstart,architecture,operations,security,authz-adapters}.md; packages/authz-conformance/; src/cli/commands/seed.ts
```

[pass 1]

## Landing decisions

### PD1 — Conformance package

Scenarios from [P4.2](../phase-4/PHASE4_P4.2_NAVIER_MODEL.md). [pass 1]

### PD2 — Seed command

Demo tuples. [pass 1]

### PD3 — Quickstart CI

Container. [pass 1]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | PD1, PD2, PD3, layout | Initial program spec. Reviewed in [round 1](reviews/PHASE7_P7.3_OSS_READINESS_PROGRAM_REVIEW.md#round-1) — VERDICT ready. | PD1: docs-only contract — unenforced | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
