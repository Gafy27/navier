# Layering

Owned by [P1.1 program](../../../phases/phase-1/PHASE1_P1.1_RUNNER_INTERFACE_PROGRAM.md)
and [P4.1 program](../../../phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM_PROGRAM.md). Summary:

- `src/runtime/` (domain: post, decide, stop, revise, close, model-step,
  tool-call, stream) imports **no runner SDK**. It talks to a `TurnRunner`
  (`src/runner/types.ts`) and to `TurnSteps` it exports.
- `src/runner/dbos/` is the only folder that imports `@dbos-inc/dbos-sdk`.
- `src/runner/temporal/` (moved `src/temporal/`, `runtime/workflow.ts`,
  `turn-loop.ts`, `reaper.ts`, `schedule.ts`, claim guard) is the only folder
  that imports `@temporalio/*`. Frozen: no new imports into it.
- `src/authz/` exposes the `NavierAuthz` seam; `src/authz/engine/` is the only
  folder that imports `authz-engine`; `src/authz/legacy/` (old gRPC client)
  exists until P4.5.
- `src/llm/` is unchanged and imported only through `ModelAdapter`.
- API processes (`src/api.ts`, `src/sdk/`) never call `DBOS.launch()`.

Checked by `commands.deps` (unavailable today).
