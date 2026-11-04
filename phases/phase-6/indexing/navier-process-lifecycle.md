# Navier process lifecycle

**Kind:** module
**Source:** `/workspace/attach/navier/src` (Navier src (navier.zip), owner code, read-only, pin `zip 2026-11-04`). Cites below are `tree/path:line` relative to each root.
**Concerns:** P6.1, P6.3
**Verdict axis:** live
**Status:** ready

**Question:** What do worker processes do on start, readiness and signal today?

## Answer in plain language

`runProcess` opens resources, serves `/healthz` and `/readyz` with per-resource probes, and on the first signal flips not-ready and closes resources in reverse order within `SHUTDOWN_TIMEOUT_MS`; a second signal escalates. The Temporal worker is one resource (`startWorker`). LISTEN runs on one dedicated connection with reconnect backoff.

## Why it matters for this project

DBOS becomes another tracked resource with a probe and a close.

## How it works

Read process and worker modules.

## Key findings and evidence

- runProcess lifecycle. [S] `navier/process/run.ts:34-110`
- Health and readiness. [S] `navier/process/health.ts:51-80`
- Shutdown budget config. [S] `navier/config.ts:11-46`
- Temporal worker resource. [S] `navier/temporal/worker.ts:46-92`
- LISTEN connection. [S] `navier/db/listen.ts:1-40`
- Logger. [S] `navier/log.ts:1-78`

## Limits and unknowns

Deployment manifests are not in `src` [U].

## Research recommendation

**Recommendation:** adopt — DBOS resource in runProcess.
**Why / consequences:** A second lifecycle would split shutdown order.
**Do not copy:** Exit the process from DBOS code. Notes describe and cite; no product code enters this repository.

## Technical references

### File map

#### P0 — read first

| File / source | What question it helps verify |
|---------------|-------------------------------|
| `navier/process/run.ts` | lifecycle |

#### P1 — implementation detail

| File / source | When to open it |
|---------------|-----------------|
| `navier/process/health.ts` | probes |
