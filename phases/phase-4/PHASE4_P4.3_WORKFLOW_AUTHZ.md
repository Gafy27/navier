# P4.3 Identity propagation and checks inside DBOS steps: identity from rows, principal bound per step transaction, checks at tool call and approval, writes audited in the same commit

Status: BINDING through pass 2
Depends on: product contract [`README.md`](../../README.md); [P2.1](../phase-2/PHASE2_P2.1_TURN_WORKFLOW.md), [P2.2](../phase-2/PHASE2_P2.2_STEPS_RETRIES.md), [P2.4](../phase-2/PHASE2_P2.4_APPROVAL_PAUSE.md), [P4.1](PHASE4_P4.1_AUTHZ_SEAM.md), [P4.2](PHASE4_P4.2_NAVIER_MODEL.md).
Program: [`PHASE4_P4.3_WORKFLOW_AUTHZ_PROGRAM.md`](PHASE4_P4.3_WORKFLOW_AUTHZ_PROGRAM.md). Review: [`reviews/PHASE4_P4.3_WORKFLOW_AUTHZ_REVIEW.md`](reviews/PHASE4_P4.3_WORKFLOW_AUTHZ_REVIEW.md).
Sources: research [authz-engine-contract](indexing/authz-engine-contract.md); `navier/runtime/request-context.ts:17-53`.

## Design explained

**No identity in DBOS (D1).** The workflow input remains ids ([P2.1](../phase-2/PHASE2_P2.1_TURN_WORKFLOW.md) L2). Steps derive identity from rows: the posting principal is the `sdk__principalId` the post wrote into the turn's request context (`navier/runtime/request-context.ts:17-53`), and the agent principal is `agent:<org>~<agentId>` from the message pin. Nothing identity-bearing is checkpointed in `dbos.*` tables.

**Same Postgres, transaction-bound (D2).** authz-engine is provisioned into Navier's database (schema `authz`) by `provision()` at deploy (`aze/README.md:10`), next to the `dbos` schema. A check runs as `authz.as(principal).tx(tx, t => t.check(...))`: the engine sets the principal as the first statement of the caller's transaction and it ends with it (`aze/phases/phase-2/PHASE2_P2.4_IDENTITY_INVOCATION.md:44-46`, `aze/phases/phase-2/PHASE2_P2.4_IDENTITY_INVOCATION.md:64-67`, `aze/phases/phase-4/PHASE4_P4.4_TX_CACHE_CONSISTENCY.md:43-45`).

**Tool call (D3).** The `toolCall` step's claim transaction (`navier/runtime/tool-call.ts:468-484`) first runs both checks of [P4.2](PHASE4_P4.2_NAVIER_MODEL.md) D3, then appends `running`. Deny → the action closes `tool_denied` with the structured reason (as today, `navier/runtime/tool-call.ts:313-321`); allow and claim commit together, so a revocation committed before the claim is always seen. The tool executes after commit, as today.

**Approval (D4).** `decide`'s transaction (`navier/runtime/decide.ts:501-511`) binds the decider as principal and checks `conversation#decide`, agent-version `use` and tool `invoke` before writing the decision and the DBOS `resume` message ([P2.4](../phase-2/PHASE2_P2.4_APPROVAL_PAUSE.md) D3) — all one commit.

**Post (D5).** The edge `invoke` checks (`navier/runtime/edge.ts:20-43`) and agent `use` run inside the post transaction that also enqueues the workflow ([P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) D1), so a turn is never enqueued on a stale allow.

**Audit (D6).** authz writes are audited by the engine in the same transaction (`aze/phases/phase-2/PHASE2_P2.5_WRITES_AUDIT.md:59-61`, `aze/phases/phase-2/PHASE2_P2.5_WRITES_AUDIT.md:73-74`); Navier keeps its own audit rows for runtime events. Denied tool calls are already audited as action rows.

**Errors (D7).** AZ errors map at the seam: AZ001/AZ003 → `unavailable` error (misconfiguration, step retries then turn errors); AZ002/AZ021 → deny `invalid_scope`; unknown → `unavailable` (`aze/phases/phase-2/PHASE2_P2.4_IDENTITY_INVOCATION.md:60-62`, `aze/phases/phase-4/PHASE4_P4.3_TYPEGEN_ERRORS.md:56-58`). `unavailable` is retryable in the step ([P2.2](../phase-2/PHASE2_P2.2_STEPS_RETRIES.md) D2); a deny never is.

**Roles (D8).** The worker and API use the app role (EXECUTE on engine entrypoints); service calls (`checkAs`, import) use `authz.service()` only in the migration job (`aze/phases/phase-2/PHASE2_P2.4_IDENTITY_INVOCATION.md:52-58`).

## Context and scope

Transaction-bound identity is the reason authz-engine fits DBOS steps: one Postgres, one commit.

## Goals and non-goals

**Goals**

- **G1 —** Check and effect commit atomically.
- **G2 —** No identity in DBOS tables.

**Non-goals**

- Authorizing inside tool implementations (tools get the ToolContext as today).

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Identity source | rows | principal | request context |
| Binding | tx-local principal | engine | aze P2.4 |
| Tool check | claim tx | deny or running | tool-call |
| Decide check | decision tx | decision + resume | decide |
| Errors | AZ codes | Navier codes | seam L2 |

## Decisions and rationale

### D1 — Identity from rows, never inputs

Principal loaded in-step. [pass 1]

### D2 — Same database, principal per transaction

Schema `authz`; `as(p).tx(tx)`. [pass 1]

### D3 — Tool check in the claim transaction

Both checks, then `running`. [pass 1]

### D4 — Decide checks in the decision transaction

With the resume send. [pass 1]

### D5 — Post checks in the enqueue transaction

No stale allow. [pass 1]

### D6 — Engine audits authz writes in tx

Navier audits runtime. [pass 1]

### D7 — AZ error mapping

Fail closed; unavailable retryable. [pass 2]

### D8 — App role vs service role

Service only in migration. [pass 2]

## Invariants

- **L1 —** No authorization decision is reused across transactions. [pass 1]

## Relevant cross-cutting concerns

Security review: [P7.2](../phase-7/PHASE7_P7.2_SECURITY_REVIEW.md).

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2, D3, D4, D5, D6, D7, L1 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE4_P4.3_WORKFLOW_AUTHZ_REVIEW.md#round-1) — VERDICT fix-then-ready. | D1: principal in workflow input — identity in dbos tables; D2: separate authz database — no atomic check+claim; L1: cache decisions per turn — misses revocation | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | D7 | Review fixes for R1-F1 ([round 1](reviews/PHASE4_P4.3_WORKFLOW_AUTHZ_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE4_P4.3_WORKFLOW_AUTHZ_REVIEW.md#round-2) — VERDICT ready. | — | [review round 1](reviews/PHASE4_P4.3_WORKFLOW_AUTHZ_REVIEW.md#round-1); new D8 delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
