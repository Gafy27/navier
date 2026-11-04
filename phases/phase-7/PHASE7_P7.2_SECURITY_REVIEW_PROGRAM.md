# P7.2 Security review — program design

Status: BINDING through pass 3
Architecture: [`PHASE7_P7.2_SECURITY_REVIEW.md`](PHASE7_P7.2_SECURITY_REVIEW.md) (BINDING through pass 2).
Depends on: [P7.2](PHASE7_P7.2_SECURITY_REVIEW.md) architecture.
Tickets: [`PHASE7_P7.2_SECURITY_REVIEW_TICKETS.md`](PHASE7_P7.2_SECURITY_REVIEW_TICKETS.md). Review: [`reviews/PHASE7_P7.2_SECURITY_REVIEW_PROGRAM_REVIEW.md`](reviews/PHASE7_P7.2_SECURITY_REVIEW_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Architecture rules mapped to owners | [Architecture rules mapped to owners](#architecture-rules-mapped-to-owners) |
| PD1 | [Grants script](#pd1--grants-script) |
| PD2 | [Payload assert in register wrapper](#pd2--payload-assert-in-register-wrapper) |
| PD3 | [Retention workflow](#pd3--retention-workflow) |

## Implementation explained

Grants as a migrate-role script (PD1); assert in the register wrapper (PD2); retention on `maintenance` queue (PD3).

## Architecture rules mapped to owners

| Architecture ids | Owning file / operation | Enforcement or delegation |
|------------------|-------------------------|---------------------------|
| D1 | `scripts/db/roles.ts` | grants |
| D2 | `runner/dbos/register.ts` | assert |
| D4 | `runner/dbos/retention.ts` | job |

[pass 1]

## Landing decisions

### PD1 — Grants script

Idempotent. [pass 2]

### PD2 — Payload assert in register wrapper

Throws at enqueue. [pass 3]

### PD3 — Retention workflow

Daily schedule. [pass 1]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | PD1, PD2, PD3, owners | Initial program spec. Reviewed in [round 1](reviews/PHASE7_P7.2_SECURITY_REVIEW_PROGRAM_REVIEW.md#round-1) — VERDICT not-ready. | PD2: lint only — runtime values escape lint | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | draft (superseded by next pass) | PD1 | Review fixes for R1-F1 ([round 1](reviews/PHASE7_P7.2_SECURITY_REVIEW_PROGRAM_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE7_P7.2_SECURITY_REVIEW_PROGRAM_REVIEW.md#round-2) — VERDICT not-ready. | — | [review round 1](reviews/PHASE7_P7.2_SECURITY_REVIEW_PROGRAM_REVIEW.md#round-1) |
| 3 | 2026-11-04 | BINDING | PD2 | Review fixes for R2-F1 ([round 2](reviews/PHASE7_P7.2_SECURITY_REVIEW_PROGRAM_REVIEW.md#round-2)). Reviewed in [round 3](reviews/PHASE7_P7.2_SECURITY_REVIEW_PROGRAM_REVIEW.md#round-3) — VERDICT ready. | — | [review round 2](reviews/PHASE7_P7.2_SECURITY_REVIEW_PROGRAM_REVIEW.md#round-2); BINDING by owner request (pt151u) after VERDICT ready |
