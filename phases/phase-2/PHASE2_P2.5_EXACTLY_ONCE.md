# P2.5 Atomic start, exactly-once writes, versioning and the replay-test replacement: enqueue in the post transaction; guarded appends; at-least-once model calls; patch discipline; recovery tests

Status: BINDING through pass 3 — unresolved: R3-F1, R3-F2; accepted by owner request (pt151u) 2026-11-04
Depends on: product contract [`README.md`](../../README.md); [P2.1](PHASE2_P2.1_TURN_WORKFLOW.md)–[P2.4](PHASE2_P2.4_APPROVAL_PAUSE.md), [P0.3](../phase-0/PHASE0_P0.3_DBOS_FIT.md) B1.
Program: [`PHASE2_P2.5_EXACTLY_ONCE_PROGRAM.md`](PHASE2_P2.5_EXACTLY_ONCE_PROGRAM.md). Review: [`reviews/PHASE2_P2.5_EXACTLY_ONCE_REVIEW.md`](reviews/PHASE2_P2.5_EXACTLY_ONCE_REVIEW.md).
Sources: research [dbos-workflow-semantics](indexing/dbos-workflow-semantics.md); `dbos/dist/src/sysdb_migrations/internal/migrations.js:544-640`; `dbos/dist/src/client.d.ts:122-136`.

## Design explained

**Start (D1).** `TurnRunner.start(tx, ref)` for DBOS executes `SELECT dbos.enqueue_workflow(workflow_name => 'navier.turn', queue_name => 'turns', positional_args => ARRAY[$input]::json[], workflow_id => $id, app_version => $ver, queue_partition_key => $pk, ...)` in the caller's transaction (`dbos/dist/src/sysdb_migrations/internal/migrations.js:544-640`). The rows and the start commit or roll back together, so the lost-start case (`navier/runtime/start.ts:83-112`) disappears. **[U] B1:** the function stores `portable_json`; ticket 1 is a spike proving a TS-registered workflow decodes it. Fallback B: `DBOSClient.enqueueInTransaction(pgClient, ...)` (`dbos/dist/src/client.d.ts:122-136`) using the transaction's `pg` client [U whether Kysely exposes it]. Fallback C: enqueue after commit, and the audit sweep enqueues rows without a workflow ([P3.3](../phase-3/PHASE3_P3.3_SCHEDULES_SWEEPS.md)).

**Duplicates (D2).** Enqueue of an existing id hits `ON CONFLICT (workflow_uuid)` and changes nothing (`dbos/dist/src/sysdb_migrations/internal/migrations.js:620`); edit/retry create new agent messages, hence new ids (L1 of [P2.1](PHASE2_P2.1_TURN_WORKFLOW.md)).

**Writes (D3).** Every step write stays a guarded append (`navier/db/append.ts:42-75`); a re-run of an interrupted step writes nothing new, and a completed step is never re-run.

**Model calls (D4).** An interrupted `modelStep` re-runs and may call the model again — at-least-once, same as an activity lost before its claim today. Deltas from the lost attempt stay ([P0.4](../phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) D7).

**Tool effects (D5).** Same as today: an interrupted tool re-runs only if `retryOnInterrupt` and a resume pointer exist, else closes `interrupted` (`navier/runtime/tool-call.ts:440-467`) — with the DB-derived attempt ([P2.2](PHASE2_P2.2_STEPS_RETRIES.md) D4).

**Versioning (D6).** Each deploy pins `applicationVersion` (`dbos/dist/src/dbos-executor.d.ts:63-66`). A change that alters the step sequence of in-flight workflows is wrapped in `DBOS.patch('<name>')` and later removed with `deprecatePatch` (`dbos/dist/src/dbos.d.ts:718-728`); otherwise old-version workflows finish on workers of their version (blue-green) [Doc].

**Replacing replay tests (D7).** Replay tests (`navier/temporal/replay.test.ts:1-33`) stay with the frozen adapter. The DBOS path gets: (a) kill-during-step tests per step kind (recover and finish with identical rows); (b) a patch test that starts a workflow on build N and finishes on build N+1; (c) `forkWorkflow` from step k reproducing a production incident on a copy (`dbos/dist/src/dbos.d.ts:429`); (d) the determinism ban of [P2.1](PHASE2_P2.1_TURN_WORKFLOW.md) PD3.

**Transactions (D8).** Steps keep Navier's `withTransaction` (`navier/db/db.ts:56-74`). DBOS `KyselyDataSource` transactions would record exactly-once completion for `finishTurn`/`pauseTurn` [Doc], but those writes are already CAS-guarded; adding a second transaction manager is not minimum.

## Context and scope

Audit rows A6, A13, A21.

## Goals and non-goals

**Goals**

- **G1 —** No lost or duplicate start.
- **G2 —** Deploys never strand an in-flight turn.
- **G3 —** Determinism regressions caught before merge.

**Non-goals**

- Exactly-once model calls (impossible without provider idempotency).

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Start | SQL enqueue in tx | atomic | B1 spike |
| Writes | guarded appends | idempotent | append.ts |
| Versioning | pin + patch | safe deploys | [P6.1](../phase-6/PHASE6_P6.1_WORKER_DEPLOYMENT.md) |
| Tests | kill, patch, fork | replay replacement | [P7.1](../phase-7/PHASE7_P7.1_TEST_MATRIX.md) |

## Decisions and rationale

### D1 — SQL enqueue inside the transaction

Fallbacks B (enqueueInTransaction) and C (after commit + sweep). [pass 2]

### D2 — Duplicate enqueue is a no-op

ON CONFLICT on workflow id. [pass 1]

### D3 — Guarded appends unchanged

Exactly-once rows. [pass 1]

### D4 — Model call at-least-once

Accepted, as today. [pass 1]

### D5 — Tool interruption rule unchanged

With DB attempt. [pass 1]

### D6 — Pinned version + patch

Blue-green otherwise. [pass 3]

### D7 — Kill, patch and fork tests

Replace replay tests on the DBOS path. [pass 3]

### D8 — No DBOS transactions

Steps use `withTransaction`. [pass 1]

## Unresolved questions and blockers

| Id | Assumption or unknown | Source or evidence gap | Affected decision / blocked work | Resolution needed |
|----|-----------------------|------------------------|----------------------------------|-------------------|
| B1 | portable_json args decode in a TS workflow | not executed | D1 | ticket 1 spike; else fallback B [pass 1] |
| B2 | Kysely tx exposes its pg client for enqueueInTransaction | Kysely API [U] | D1 fallback B | spike with fallback C [pass 2] |

Open review findings at BINDING: R3-F1, R3-F2 — see [`reviews/PHASE2_P2.5_EXACTLY_ONCE_REVIEW.md`](reviews/PHASE2_P2.5_EXACTLY_ONCE_REVIEW.md). The owner request (pt151u) authorizes BINDING after three rounds; these items keep their owners in the review Response tables.

## Relevant cross-cutting concerns

Security: the SQL call passes ids only ([P2.1](PHASE2_P2.1_TURN_WORKFLOW.md) L2); the API role needs EXECUTE on `dbos.enqueue_workflow` and `dbos.send_message` only ([P7.2](../phase-7/PHASE7_P7.2_SECURITY_REVIEW.md)).

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2, D3, D4, D5, D6, D7, D8, B1 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE2_P2.5_EXACTLY_ONCE_REVIEW.md#round-1) — VERDICT not-ready. | D1: start after commit — keeps the reaper; D6: unpinned versions — recovery runs new code on old histories; D8: KyselyDataSource everywhere — second tx manager for CAS-guarded writes | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | draft (superseded by next pass) | D1 | Review fixes for R1-F1 ([round 1](reviews/PHASE2_P2.5_EXACTLY_ONCE_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE2_P2.5_EXACTLY_ONCE_REVIEW.md#round-2) — VERDICT not-ready. | — | [review round 1](reviews/PHASE2_P2.5_EXACTLY_ONCE_REVIEW.md#round-1); new B2 delegated to designer (pt151u), recommend-A |
| 3 | 2026-11-04 | BINDING | D7, D6 | Review fixes for R2-F1, R2-F2 ([round 2](reviews/PHASE2_P2.5_EXACTLY_ONCE_REVIEW.md#round-2)). Reviewed in [round 3](reviews/PHASE2_P2.5_EXACTLY_ONCE_REVIEW.md#round-3) — VERDICT not-ready. | — | [review round 2](reviews/PHASE2_P2.5_EXACTLY_ONCE_REVIEW.md#round-2); BINDING by owner request (pt151u) after round 3 not-ready — unresolved R3-F1, R3-F2 accepted as recorded in the review file |
