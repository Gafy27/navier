# Current state of one agent turn

Pin: zip 2026-11-04. `navier/` is `src/` in this repo. Function name is the stable key; update line ranges when code moves.

Ten stages over Postgres rows. The runner schedules and retries; turn state lives in rows only. Writes use `appendIfNewest` `navier/db/append.ts:42-75` (repeated activity is a no-op). Temporal history holds ids and control flow (`TurnWorkflowInput` `navier/runtime/workflow-types.ts:13-18`).

| # | Stage | Function and range | Writes | Runner coupling |
|---|-------|--------------------|--------|-----------------|
| 1 | post / accept | `postTurn` `navier/runtime/post.ts:475-502`, `writeTurn` `navier/runtime/post.ts:446-473` | user + agent message (`created`) or `pending_message` | starts workflow after commit |
| 2 | start | `startCommitted` `navier/runtime/start.ts:83-112`, `startTurn` `navier/runtime/start.ts:130-179` | nothing (Temporal start) | `turnWorkflowId` `navier/runtime/workflow-id.ts:4-10` (`turn~org~thread~msg`); failed start left to reaper |
| 3 | workflow | `turnWorkflow` `navier/runtime/workflow.ts:25-37`, `runTurn` `navier/runtime/turn-loop.ts:192-228` | none | signals, scopes, continue-as-new |
| 4 | load | `loadTurn` `navier/runtime/activities.ts:105-157` | `started` status | activity |
| 5 | model step | `runModelStep` `navier/runtime/model-step.ts:512-564` | step + actions (guarded), deltas | activity + `step_claim` |
| 6 | tool call | `runToolCall` `navier/runtime/tool-call.ts:370-547` | action status, result | activity; attempt number |
| 7 | pause | `pauseMessage` `navier/runtime/close.ts:299-346` | `paused`, `expires_at`, snapshot | workflow ends |
| 8 | decide | `decide` `navier/runtime/decide.ts:469-535` | decision, `resumed` | restarts same workflow id |
| 9 | close | `closeTurn` `navier/runtime/close.ts:47-125` | terminal status, pending promotion | promoted start |
| 10 | stream | `appendDelta` `navier/runtime/stream.ts:62-104`, `createStreamHub` `navier/api/stream-hub.ts:41-100` | `stream_delta` + NOTIFY | none |

## llm

`ModelAdapter` `navier/llm/types.ts:81-88` is runner-neutral. Vercel AI SDK is transport inside `llm/` only (`navier/llm/errors.ts:1-10`, `navier/llm/providers/generate.ts:1-8`). The runner adds none; `llm/` stays unchanged (D4).

## Authz (see P4.1)

- post: `prepareTurn` `navier/runtime/post.ts:86-125`
- tool: `check` `navier/runtime/tool-call.ts:323-364`
- decide: `authorize` `navier/runtime/decide.ts:164-196`
- stop: `requestStop` `navier/runtime/stop.ts:64-140`
