# P3.4 Schema and config inventory after simplification: every table and key: used by both, Temporal-only, or DBOS-only — no table dropped

Status: BINDING through pass 1
Depends on: product contract [`README.md`](../../README.md); [P3.1](PHASE3_P3.1_CLAIMS_RECOVERY.md)–[P3.3](PHASE3_P3.3_SCHEDULES_SWEEPS.md).
Program: [`PHASE3_P3.4_SCHEMA_MIGRATIONS_PROGRAM.md`](PHASE3_P3.4_SCHEMA_MIGRATIONS_PROGRAM.md). Review: [`reviews/PHASE3_P3.4_SCHEMA_MIGRATIONS_REVIEW.md`](reviews/PHASE3_P3.4_SCHEMA_MIGRATIONS_REVIEW.md).
Sources: `navier/runtime/migrations.ts:27-51`; `navier/runtime/config.ts:4-15`; `navier/config.ts:11-46`.

## Design explained

**Tables (D1).** Of the 23 runtime migrations (`navier/runtime/migrations.ts:27-51`), all stay. Two become Temporal-only writers: `step_claim` (`navier/runtime/migrations/04_0010_step_claim.ts:1-18`) and `recovery` (`navier/runtime/migrations/04_0012_recovery.ts:1-18`). `stop_requested` stays used by both (`navier/runtime/migrations/04_0011_stop_requested.ts:1-18`). No column is added ([P1.1](../phase-1/PHASE1_P1.1_RUNNER_INTERFACE.md) D4 needs none).

**Drop later (D2).** Dropping the two Temporal-only tables is an owner decision after retirement ([P7.4](../phase-7/PHASE7_P7.4_DEAD_CODE.md)); until then they keep their append-only triggers.

**DBOS schema (D3).** The `dbos` schema is created and migrated by `DBOS.migrate(systemDatabaseUrl)` (`dbos/dist/src/dbos.d.ts:215`) as a deploy step before workers start, with the migration role, not by Navier's migrator.

**Config (D4).**

| Key | After |
|-----|-------|
| `MODEL_CALL_TIMEOUT_MS`, `MODEL_ATTEMPTS`, `TOOL_CALL_TIMEOUT_MS`, `STORE_CALL_TIMEOUT_MS` | both (step configs) |
| `STREAM_SWEEP_INTERVAL_MS`, `STREAM_SWEEP_BATCH_SIZE` | both |
| `REAPER_BATCH_SIZE` | both (audit sweep batch) |
| `REAPER_INTERVAL_MS`, `START_GRACE_MS`, `MAX_HISTORY_LENGTH`, `TEMPORAL_*` | Temporal-only |
| `RUNNER_*`, `DBOS_*` | new ([P1.4](../phase-1/PHASE1_P1.4_RUNNER_CONFIG.md)) |

## Context and scope

Owner decision 5: keep current tables.

## Goals and non-goals

**Goals**

- **G1 —** One table of what each schema object and key is for after phase 3.

**Non-goals**

- Dropping anything.

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Tables | classification | table | migrations.ts |
| DBOS schema | migrate step | deploy | [P6.1](../phase-6/PHASE6_P6.1_WORKER_DEPLOYMENT.md) |
| Config | classification | table | config.ts |

## Decisions and rationale

### D1 — All tables stay; two Temporal-only

`step_claim`, `recovery`. [pass 1]

### D2 — Drops deferred

Owner decision after retirement. [pass 1]

### D3 — `DBOS.migrate` at deploy

Migration role. [pass 1]

### D4 — Config classification

Table. [pass 1]

## Relevant cross-cutting concerns

Grants for the `dbos` schema are [P7.2](../phase-7/PHASE7_P7.2_SECURITY_REVIEW.md).

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | D1, D2, D3, D4 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE3_P3.4_SCHEMA_MIGRATIONS_REVIEW.md#round-1) — VERDICT ready. | D2: drop at cutover — Temporal turns may still be draining; D3: let workers migrate on launch — app role would need DDL | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
