# P4.4 Migration and cutover from the old authz service: export → map → import; dual-write; shadow checks; per-org flip; reverse shadow for rollback

Status: BINDING through pass 1
Depends on: product contract [`README.md`](../../README.md); [P4.1](PHASE4_P4.1_AUTHZ_SEAM.md)–[P4.3](PHASE4_P4.3_WORKFLOW_AUTHZ.md).
Program: [`PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM.md`](PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM.md). Review: [`reviews/PHASE4_P4.4_AUTHZ_CUTOVER_REVIEW.md`](reviews/PHASE4_P4.4_AUTHZ_CUTOVER_REVIEW.md).
Sources: research [navier-authz-surface](indexing/navier-authz-surface.md), [authz-engine-contract](indexing/authz-engine-contract.md).

## Design explained

**Data (D1).** A one-off job lists every legacy grant, structure and marking per org through the old client (`listGrants`, `listGrantable`, structure via registered agents/tools/spaces, markings, `navier/identity/authz-admin.ts:70-116`), maps them with the [P4.2](PHASE4_P4.2_NAVIER_MODEL.md) mapping module, and imports with the engine's service bulk import (`aze/phases/phase-2/PHASE2_P2.5_WRITES_AUDIT.md:67-69`) into Navier's database. Output is JSONL per org for review; re-running is idempotent.

**Modes (D2)**, per org (`AUTHZ_MODE`, default `legacy`):

| Mode | Decides | Also evaluates | Writes |
|------|---------|----------------|--------|
| `legacy` | legacy | — | legacy |
| `shadow` | legacy | engine (diff logged) | legacy, then engine in Navier tx |
| `engine` | engine | — | engine; legacy via outbox for rollback window |
| `engine-shadow` | engine | legacy (diff logged) | engine; legacy via outbox |

**Diffs (D3).** A diff record holds org, action, object type, decision pair, call site — ids only, no subject text — and a metric. Fail-closed rule in shadow: if either side says `unavailable`, legacy's answer stands (it is primary).

**Dual-write (D4).** Legacy is remote, so writes cannot share a transaction. In `shadow`, the legacy write happens first; the engine write and an outbox row commit in Navier's transaction; a reconcile job re-applies outbox rows whose engine write failed. In `engine`, the engine write commits in Navier's tx with an outbox row for legacy, applied after commit.

**Flip (D5).** An org flips `shadow → engine-shadow` after 7 consecutive days with zero diffs (or only diffs explained by the owner-approved tightening of [P4.2](PHASE4_P4.2_NAVIER_MODEL.md) D3, tagged), and `engine-shadow → engine` after 7 more. Global flip when all orgs are `engine`.

**Rollback (D6).** Flip the org back one mode; the outbox has kept legacy current. Rollback is possible until [P4.5](PHASE4_P4.5_GRPC_REMOVAL.md) lands.

**Order (D7).** Authz cutover is independent of the runner cutover ([Phase 5](../phase-5/README.md)) but both use per-org flags; the runbook runs the runner flip first ([P5.4](../phase-5/PHASE5_P5.4_RUNBOOK.md)).

## Context and scope

Owner: keep the old authz behind the seam only until cutover.

## Goals and non-goals

**Goals**

- **G1 —** Zero unexplained diffs before any flip.
- **G2 —** One-flag rollback per org.

**Non-goals**

- Changing legacy semantics.

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Export/import job | data mapping | JSONL + import | [P4.2](PHASE4_P4.2_NAVIER_MODEL.md) mapping |
| Shadow adapter | both sides | diff log | seam |
| Outbox | dual-write | reconcile | Navier tx |
| Flags | modes per org | flip/rollback | [P5.2](../phase-5/PHASE5_P5.2_ROLLOUT_FLAGS.md) |

## Decisions and rationale

### D1 — Export, map, import

Idempotent job. [pass 1]

### D2 — Four modes per org

Table. [pass 1]

### D3 — Ids-only diff log

Primary answer stands. [pass 1]

### D4 — Dual-write with outbox

Reconcile job. [pass 1]

### D5 — Flip after 7 clean days, twice

Tagged tightening diffs allowed. [pass 1]

### D6 — Rollback by flag

Until removal. [pass 1]

### D7 — Runner flip first

Runbook order. [pass 1]

## Relevant cross-cutting concerns

Diff logs are retained 30 days, ids only ([P7.2](../phase-7/PHASE7_P7.2_SECURITY_REVIEW.md)).

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | D1, D2, D3, D4, D5, D6, D7 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE4_P4.4_AUTHZ_CUTOVER_REVIEW.md#round-1) — VERDICT ready. | D2: direct cutover — no evidence; D4: engine first in shadow — legacy is primary; D5: percentage of checks — orgs are the support unit | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
