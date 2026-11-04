# Phase 0 overview — Research and map

Condensed inputs for the research phase. Sources: the Navier zip (`/workspace/attach/navier/src`, 375 TypeScript files),
the installed DBOS SDK 5.4.0 under `/workspace/dbos-agent/node_modules/@dbos-inc/dbos-sdk`, the owner's DBOS prototype
`/workspace/dbos-agent`, docs.dbos.dev (read 2026-11-04), and the owner's goal:
"make design phases to add dbos via postgres as the runner replacing temporal ... and simplify it to the minimum,
especially all the things around the main agent workflow".

## Requirements

- R1. One map of the turn lifecycle with line-ranged anchors every later unit cites ([P0.1](PHASE0_P0.1_CURRENT_STATE_MAP.md)).
- R2. An inventory of every Temporal feature Navier uses and the reason for each piece of surrounding machinery ([P0.2](PHASE0_P0.2_TEMPORAL_INVENTORY.md)).
- R3. A DBOS mapping per need with evidence tags ([P0.3](PHASE0_P0.3_DBOS_FIT.md)).
- R4. A verdict table — keep / replace-by-DBOS / delete / simplify — with justification ([P0.4](PHASE0_P0.4_SIMPLIFICATION_AUDIT.md)).

## Unit map

| Unit | Delivers | Used by |
|------|----------|---------|
| [P0.1](PHASE0_P0.1_CURRENT_STATE_MAP.md) | current-state map, anchors | every phase |
| [P0.2](PHASE0_P0.2_TEMPORAL_INVENTORY.md) | Temporal inventory + "why it exists" map | [P0.3](PHASE0_P0.3_DBOS_FIT.md), [P0.4](PHASE0_P0.4_SIMPLIFICATION_AUDIT.md), [Phase 1](../phase-1/README.md) |
| [P0.3](PHASE0_P0.3_DBOS_FIT.md) | DBOS feature mapping, gaps, `[U]` list | [Phase 2](../phase-2/README.md), [Phase 6](../phase-6/README.md) |
| [P0.4](PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) | simplification audit table | [Phase 3](../phase-3/README.md), [P7.4](../phase-7/PHASE7_P7.4_DEAD_CODE.md) |
