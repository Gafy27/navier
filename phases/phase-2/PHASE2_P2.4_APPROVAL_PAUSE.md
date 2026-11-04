# P2.4 Approval and pause as a durable wait: `pauseTurn` step → `recv("turn", deadline = expires_at)` → resume, stop or expire — no restart, no reaper pass

Status: BINDING through pass 2
Depends on: product contract [`README.md`](../../README.md); [P2.1](PHASE2_P2.1_TURN_WORKFLOW.md), [P2.3](PHASE2_P2.3_STOP_INTERRUPT.md).
Program: [`PHASE2_P2.4_APPROVAL_PAUSE_PROGRAM.md`](PHASE2_P2.4_APPROVAL_PAUSE_PROGRAM.md). Review: [`reviews/PHASE2_P2.4_APPROVAL_PAUSE_REVIEW.md`](reviews/PHASE2_P2.4_APPROVAL_PAUSE_REVIEW.md).
Sources: research [stop-and-pause-paths](indexing/stop-and-pause-paths.md), [dbos-agent-prototype](../phase-0/indexing/dbos-agent-prototype.md).

## Design explained

**Pause (D1).** When a tool blocks or the model step reports `waiting`, the workflow runs `pauseTurn` (today's `pauseMessage`, `navier/runtime/close.ts:299-346`), which writes `paused`, `expires_at` and the snapshot and returns `{ pausedSeq, expiresAtEpochMs }`. The workflow stays alive.

**Wait (D2).** `msg = DBOS.recv('turn', { deadlineEpochMS: expiresAtEpochMs })` (`dbos/dist/src/dbos.d.ts:115-121`, `dbos/dist/src/dbos.d.ts:583`). The deadline is absolute and comes from a checkpointed step output, so recovery does not extend it.

**Decide (D3).** `decide` keeps its transaction (`navier/runtime/decide.ts:501-511`) — decision row, audit, `created/resumed` append — and adds `dbos.send_message(wfId, '{"kind":"resume"}', 'turn', 'resume:' || pausedSeq)` in it. The restart (`navier/runtime/decide.ts:514-533`) is deleted. Idempotency by `pausedSeq` makes a retried decide a no-op.

**Outcomes (D4).**

| `recv` returns | Action |
|----------------|--------|
| `resume` | loop back to `loadTurn`: approved actions run, still-blocked ones pause again (new `pausedSeq`, new wait) |
| `stop` | finish with the stop status ([P2.3](PHASE2_P2.3_STOP_INTERRUPT.md) L1) |
| `null` (deadline) | `finishTurn(expired, pause_timeout, expected = paused)`; if the CAS loses (a decision committed by the DB clock first, `navier/runtime/decide.ts:307-338`), `recv` again with a 30 s deadline and handle the message |

The DB clock decides whether a decision was in time (unchanged); the worker clock only decides when to look. Clock skew therefore never loses a decision.

**Slot (D5).** The paused workflow holds its partition slot ([P2.1](PHASE2_P2.1_TURN_WORKFLOW.md) D2); new posts on the thread are pending, as today.

**Deleted (D6).** Reaper pause passes (`navier/runtime/reaper.ts:388-512`) and decide restart are not used on the DBOS path.

## Context and scope

Audit rows A9, A14; prototype pattern.

## Goals and non-goals

**Goals**

- **G1 —** No reaper or restart for approvals.
- **G2 —** A decision committed before `expires_at` by the DB clock is never lost.

**Non-goals**

- Approval policy and remembered approvals (unchanged, `navier/runtime/approval.ts:41-84`).

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| pauseTurn step | paused row | seq + deadline | close.ts |
| Wait | recv | message or null | DBOS |
| decide tx | resume message | idempotent | decide.ts |
| Expiry | CAS close | expired | closeTurn |

## Decisions and rationale

### D1 — Pause in place

Workflow stays alive. [pass 1]

### D2 — recv with absolute deadline

From the checkpointed pause output. [pass 1]

### D3 — decide sends `resume`

Key `resume:<pausedSeq>`; restart deleted. [pass 1]

### D4 — Outcome table

Resume / stop / expiry with CAS and re-wait. [pass 2]

### D5 — Slot held while paused

Matches pending semantics. [pass 1]

### D6 — Reaper pause passes unused

DBOS path. [pass 1]

## Invariants

- **L1 —** The DB clock alone decides whether a decision beat `expires_at`. [pass 2]

## Relevant cross-cutting concerns

Authz for the approver stays in decide ([P4.3](../phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ.md)).

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2, D3, D4, D5, D6 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE2_P2.4_APPROVAL_PAUSE_REVIEW.md#round-1) — VERDICT fix-then-ready. | D1: end and restart with suffixed id — new ids, reaper still needed; D2: relative timeout — extended by recovery; D4: trust the worker clock — loses late-but-valid decisions | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | D4 | Review fixes for R1-F1 ([round 1](reviews/PHASE2_P2.4_APPROVAL_PAUSE_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE2_P2.4_APPROVAL_PAUSE_REVIEW.md#round-2) — VERDICT ready. | — | [review round 1](reviews/PHASE2_P2.4_APPROVAL_PAUSE_REVIEW.md#round-1); new L1 delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
