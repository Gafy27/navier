# P1.4 Runner configuration and selection — program design

Status: BINDING through pass 1
Architecture: [`PHASE1_P1.4_RUNNER_CONFIG.md`](PHASE1_P1.4_RUNNER_CONFIG.md) (BINDING through pass 1).
Depends on: [P1.4](PHASE1_P1.4_RUNNER_CONFIG.md) architecture.
Tickets: [`PHASE1_P1.4_RUNNER_CONFIG_TICKETS.md`](PHASE1_P1.4_RUNNER_CONFIG_TICKETS.md). Review: [`reviews/PHASE1_P1.4_RUNNER_CONFIG_PROGRAM_REVIEW.md`](reviews/PHASE1_P1.4_RUNNER_CONFIG_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Types, signatures, and caller contracts | [Types, signatures, and caller contracts](#types-signatures-and-caller-contracts) |
| Architecture rules mapped to owners | [Architecture rules mapped to owners](#architecture-rules-mapped-to-owners) |
| PD1 | [Compare parsed URLs](#pd1--compare-parsed-urls) |

## Implementation explained

One schema file; the boot check compares parsed URLs (PD1).

## Types, signatures, and caller contracts

```ts
export const RunnerConfigSchema = z.object({
  RUNNER_DEFAULT: z.enum(['dbos', 'temporal']).default('dbos'),
  RUNNER_TEMPORAL_ORGS: z.string().default('').transform(csvOrgIds),
  DBOS_SYSTEM_DATABASE_URL: z.string().optional(),
  DBOS_APP_VERSION: z.string().min(1),
  DBOS_EXECUTOR_ID: z.string().optional(),
});
```

[pass 1]

## Architecture rules mapped to owners

| Architecture ids | Owning file / operation | Enforcement or delegation |
|------------------|-------------------------|---------------------------|
| D1 | `src/runner/config.ts` | schema |
| D4 | `src/runner/config.ts` | `sameDatabase(a, b)` |

[pass 1]

## Landing decisions

### PD1 — Compare parsed URLs

host, port, database name; user may differ. [pass 1]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | PD1, types, owners | Initial program spec. Reviewed in [round 1](reviews/PHASE1_P1.4_RUNNER_CONFIG_PROGRAM_REVIEW.md#round-1) — VERDICT ready. | PD1: string equality — breaks on param order | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
