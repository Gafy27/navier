# authz-engine contract Navier relies on

**Kind:** module
**Source:** `/workspace/authz-engine` (owner authz-engine design repository, owner design, pin `design 2026-11-03`). Cites below are `tree/path:line` relative to each root.
**Concerns:** P4.1–P4.4
**Verdict axis:** live
**Status:** ready

**Question:** What does authz-engine promise: verbs, identity, errors, transactions, agents, approvals, writes and audit?

## Answer in plain language

Five verbs scoped to a principal (`authz.as(p)`), a decision with allow / deny / not_visible plus revision, a service client for privileged calls; a transaction-local principal `{type, id, actingFor?}` set as the first statement and never outliving the transaction, missing principal is an error; SQLSTATE codes AZ001–AZ021; unknown errors fail closed; `tx` binds once and shares the user's transaction; writes are atomic, idempotent, audited in the same transaction; service bulk import; agents act for users by intersection; approvals can be expiring grants; `provision()` installs idempotently.

## Why it matters for this project

Transaction-bound identity on the same Postgres lets a DBOS step check and claim in one commit.

## How it works

Read README and the BINDING specs named in the phase overview.

## Key findings and evidence

- Five verbs. [S] `aze/phases/phase-4/PHASE4_P4.1_SDK_API.md:56-62`
- Scoped to principal. [S] `aze/phases/phase-4/PHASE4_P4.1_SDK_API.md:64-66`
- Tx-local principal and trust modes. [S] `aze/phases/phase-2/PHASE2_P2.4_IDENTITY_INVOCATION.md:44-50`
- SQLSTATE contract. [S] `aze/phases/phase-2/PHASE2_P2.4_IDENTITY_INVOCATION.md:60-62`
- Laws L1/L2. [S] `aze/phases/phase-2/PHASE2_P2.4_IDENTITY_INVOCATION.md:64-67`
- Writes and audit. [S] `aze/phases/phase-2/PHASE2_P2.5_WRITES_AUDIT.md:47-74`
- Errors fail closed, catalog. [S] `aze/phases/phase-4/PHASE4_P4.3_TYPEGEN_ERRORS.md:52-66`
- tx shares the user transaction. [S] `aze/phases/phase-4/PHASE4_P4.4_TX_CACHE_CONSISTENCY.md:43-61`
- Agent principal, intersection, approvals. [S] `aze/phases/phase-5/PHASE5_P5.2_AGENT_GUARDS_MCP.md:55-89`
- Agent template model. [S] `aze/phases/phase-6/PHASE6_P6.2_AGENTS_TOOLS.md:1-60`
- provision and @deny. [S] `aze/README.md:10-19`

## Limits and unknowns

Designs only; no package exists [U].

## Research recommendation

**Recommendation:** adopt — five verbs, `as({agent, actingFor})`, `tx` inside Navier transactions, service import for migration.
**Why / consequences:** Matches Navier's Postgres-only stance.
**Do not copy:** Cite. Notes describe and cite; no product code enters this repository.

## Technical references

### File map

#### P0 — read first

| File / source | What question it helps verify |
|---------------|-------------------------------|
| `aze/phases/phase-4/PHASE4_P4.1_SDK_API.md` | SDK |
| `aze/phases/phase-2/PHASE2_P2.4_IDENTITY_INVOCATION.md` | identity |

#### P1 — implementation detail

| File / source | When to open it |
|---------------|-----------------|
| `aze/phases/phase-5/PHASE5_P5.2_AGENT_GUARDS_MCP.md` | agents |

#### Skip

| Path / source | Why it is outside this question |
|---------------|---------------------------------|
| `aze/phases/phase-3` | non-Postgres dialects |
