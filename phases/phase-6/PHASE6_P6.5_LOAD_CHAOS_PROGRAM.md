# P6.5 Load and chaos tests — program design

Status: BINDING through pass 1
Architecture: [`PHASE6_P6.5_LOAD_CHAOS.md`](PHASE6_P6.5_LOAD_CHAOS.md) (BINDING through pass 2).
Depends on: [P6.5](PHASE6_P6.5_LOAD_CHAOS.md) architecture.
Tickets: [`PHASE6_P6.5_LOAD_CHAOS_TICKETS.md`](PHASE6_P6.5_LOAD_CHAOS_TICKETS.md). Review: [`reviews/PHASE6_P6.5_LOAD_CHAOS_PROGRAM_REVIEW.md`](reviews/PHASE6_P6.5_LOAD_CHAOS_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| PD1 | [Load driver on harness fakes](#pd1--load-driver-on-harness-fakes) |
| PD2 | [Chaos scripts](#pd2--chaos-scripts) |

## Implementation explained

Load driver reuses the harness fakes (PD1); chaos scripts are shell over kubectl and pg tools (PD2).

## Landing decisions

### PD1 — Load driver on harness fakes

Node. [pass 1]

### PD2 — Chaos scripts

Shell. [pass 1]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | PD1, PD2 | Initial program spec. Reviewed in [round 1](reviews/PHASE6_P6.5_LOAD_CHAOS_PROGRAM_REVIEW.md#round-1) — VERDICT ready. | PD1: k6 — cannot drive SSE + post flows with fakes easily [U] | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
