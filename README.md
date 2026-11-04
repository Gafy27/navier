# navier-dbos

**Design phases to run Navier's agent turns on DBOS Transact over the Postgres Navier already uses**, with Temporal kept as a frozen second runner behind a runner seam, the machinery around the main turn workflow cut to the minimum, and Navier's gRPC authz client replaced by the owner's **authz-engine**.

**This repository holds designs only.** There is no product code and no `package.json`. It contains the factory kit, the project profile, eight phases of architecture specs, program specs, ticket anexos, review records, and research notes. The code under redesign is the owner's Navier (`/workspace/attach/navier/src`, read-only, cited as `navier/path:a-b`). Tickets apply to the Navier repository.

## Owner decisions (inputs, not gates)

1. **DBOS is the only maintained runner.** Temporal stays as a frozen adapter: it keeps compiling and passing its own tests, nothing more ([P1.3](phases/phase-1/PHASE1_P1.3_TEMPORAL_FREEZE.md)).
2. **No Vercel AI SDK in the runner.** Navier's own `llm/` `ModelAdapter` stays unchanged. An AI SDK adapter could be added later behind `ModelAdapter` (rejected alternative in [P0.1](phases/phase-0/PHASE0_P0.1_CURRENT_STATE_MAP.md) D4).
3. **Streaming unchanged:** the Postgres `stream_delta` table, LISTEN/NOTIFY and the SSE hub stay.
4. **The DBOS worker is a long-lived process outside Vercel**; API processes only enqueue and send ([P6.1](phases/phase-6/PHASE6_P6.1_WORKER_DEPLOYMENT.md)).
5. **Keep the current tables; drain in-flight Temporal turns; new turns start on DBOS** ([phase 5](phases/phase-5/README.md)).
6. **Minimum.** Every piece of machinery around the turn workflow has a keep / replace-by-DBOS / delete / simplify verdict ([P0.4](phases/phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md)).
7. **authz-engine replaces Navier's authz** (`identity/authz*`, the `cosmos.authz.v1` gRPC client and what depends on it); the old client lives behind the authz seam only until the authz cutover ([phase 4](phases/phase-4/README.md)).

## Target shape (one turn)

```text
API tx:  insert user + agent message rows  ──┐
         SELECT dbos.enqueue_workflow(...)   ├─ one COMMIT (same Postgres, schema dbos)
                                              ┘
worker:  turn workflow  id turn~org~thread~msg  queue "turns", partition = thread, 1 at a time
           step loadTurn
           loop: step modelStep (retries, timeout, abort on stop)  → guarded commit + deltas
                 step toolCall × n (deterministic order)            → authz-engine check in the step's tx
                 step checkStop (stop row / pending rows)
                 pause? step pauseTurn → recv('turn', deadline = expires_at) → decision or expiry
           step finishTurn (CAS close, promote pending) → enqueue promoted turn
stop:    API tx writes stop_requested + dbos.send_message; NOTIFY wakes the worker's abort hub
```

What goes away on the DBOS path: reaper restarts, the recovery table writes, `step_claim`, start-after-commit, `START_GRACE_MS`, the pause-expiry pass, decide-restart, continue-as-new, signals, interceptors and replay tests ([phase 3](phases/phase-3/README.md)).

## Authz is pluggable (open-source plan)

Navier talks to authorization only through the `NavierAuthz` seam ([P4.1](phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM.md)). In the open-source plan that seam is the plug point: **authz-engine is the default implementation** (Postgres-native, five verbs `check` / `list` / `explain` / `write` / `tx`, `provision()`, transaction-bound identity, fail-closed, AZ error catalogue), and another engine can be supplied by implementing the seam and passing the conformance scenarios of [P4.2](phases/phase-4/PHASE4_P4.2_NAVIER_MODEL.md). The legacy gRPC adapter exists only until the authz cutover ([P4.4](phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER.md), [P4.5](phases/phase-4/PHASE4_P4.5_GRPC_REMOVAL.md)).

## How the factory works here

Each unit goes design → independent spec review (up to three rounds) → program design → program review → ticket anexo. A design still not ready after round 3 is BINDING with its unresolved findings recorded (owner instruction). The kit is in [`factory/`](factory/README.md); project rules are in [`factory/profile/navier_dbos/`](factory/profile/navier_dbos/README.md); paths and commands are in [`factory/config.yaml`](factory/config.yaml). Every command is empty here, so tickets are runnable only in the Navier repository once its scripts fill the config.

Validation (tooling outside this repo, not product code): `python3 /workspace/navier-dbos-tools/validate.py` checks three artifacts per unit, ≤ 3 review rounds, status consistency, every `navier`, `dbos`, `proto` and `aze` citation and line range, links, the ticket parser and the kit check.

## Folder map

| Path | What |
|------|------|
| `factory/` | Kit: agents, policy, templates, CLI, profile `navier_dbos`, config |
| `phases/README.md` | Plan, status of every unit, BINDING-with-unresolved list, gates for owner, decision log |
| `phases/phase-N/` | Phase README, overview, per-unit design / program / tickets, `reviews/`, `prompts/`, `indexing/` |

## Status (2026-11-04)

3 phases, 14 units, 42 unit artifacts, 45 tickets. All units BINDING by owner request; 3 carry unresolved review findings (P0.4, P2.3, P2.5). No owner gate has been answered yet — see [`phases/README.md`](phases/README.md#gates-for-owner).
