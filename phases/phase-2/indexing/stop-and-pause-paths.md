# Stop, pause, decide and expiry today

**Kind:** module
**Source:** `/workspace/attach/navier/src` (Navier src (navier.zip), owner code, read-only, pin `zip 2026-11-04`); `/workspace/dbos-agent` (owner DBOS agent prototype (verified on Neon 2026-10-28), owner prototype, pin `no-vcs`). Cites below are `tree/path:line` relative to each root.
**Concerns:** P2.3, P2.4
**Verdict axis:** live
**Status:** ready

**Question:** How do stops, pauses, decisions and expiries interact today, and what does the prototype do instead?

## Answer in plain language

`requestStop` inserts a `stop_requested` row (one per message) then signals the workflow; a paused message gets the row only and the reaper ends the pause, with stop winning over expiry. `decide` writes the decision and appends `created/resumed` in one transaction, then restarts the workflow. The prototype instead keeps the workflow alive, waiting in `recv` with a timeout, and the approver `send`s.

## Why it matters for this project

Keeping rows and replacing signals/restarts with `send` inside the same transaction removes the reaper passes.

## How it works

Read stop, reaper end-pause, decide and the prototype loop.

## Key findings and evidence

- requestStop row then signal. [S] `navier/runtime/stop.ts:64-140`
- reaper stop-over-expiry. [S] `navier/runtime/reaper.ts:429-469`
- reaper decide order. [S] `navier/runtime/reaper.ts:108-138`
- resumeMessage uses DB clock. [S] `navier/runtime/decide.ts:307-338`
- decide tx then restart. [S] `navier/runtime/decide.ts:501-533`
- pauseMessage expires_at. [S] `navier/runtime/close.ts:299-346`
- paused counts as open for pending. [S] `navier/runtime/pending.ts:30-50`
- prototype recv approval. [S] `proto/src/agent.ts:104-124`

## Limits and unknowns

None beyond the zip.

## Research recommendation

**Recommendation:** adapt — rows unchanged; `send_message` replaces signal and restart; `recv` deadline replaces the expiry pass.
**Why / consequences:** Rows keep the API and audit unchanged.
**Do not copy:** Cite. Notes describe and cite; no product code enters this repository.

## Technical references

### File map

#### P0 — read first

| File / source | What question it helps verify |
|---------------|-------------------------------|
| `navier/runtime/stop.ts` | stop |
| `navier/runtime/decide.ts` | decide |

#### P1 — implementation detail

| File / source | When to open it |
|---------------|-----------------|
| `navier/runtime/reaper.ts` | expiry |

#### Skip

| Path / source | Why it is outside this question |
|---------------|---------------------------------|
| `navier/runtime/approval.ts` | approval levels, unchanged |
