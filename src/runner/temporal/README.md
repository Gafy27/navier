# Temporal runner (frozen)

Temporal behind `TurnRunner`. Frozen means it typechecks, passes its own tests
(including the replay test) and the shared harness. No features, no refactors
(P1.3 D2). A Temporal bug is fixed only if it blocks draining (D5).

- `adapter.ts` — `createTemporalRunner(handle, deps)`: `start` starts the turn
  workflow, `wakeStop` signals it, `wakeDecision` restarts it, `awaitEnd` waits
  on the workflow result and reads the status from the rows.
- `workflow.ts`, `turn-loop.ts` — workflow code (sandboxed imports only).
- `activities.ts`, `reaper.ts`, `schedule.ts`, `stream-sweep-schedule.ts` —
  activities and schedules over the runtime steps.
- `client.ts`, `worker.ts`, `trace.ts`, `attributes.ts`, `probe.ts`,
  `replay.ts`, `workflow-interceptors.ts` — connection, worker, tracing, replay.
- `step-claim.ts` — the claim-based `StepGuard` only this runner passes (D3).

Nothing outside this folder imports it except the composition roots (L1).
Retirement deletes this folder, the Temporal config branch and the `StepGuard`
parameter (D4, P7.4).
