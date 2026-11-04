# P2.3 architecture review — Stop, interrupt and graceful stop on DBOS

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE2_P2.3_STOP_INTERRUPT.md`](../PHASE2_P2.3_STOP_INTERRUPT.md) (kind `architecture`), passes 1–3.
**Not reviewed:** the program sibling and the anexo (anexo review is on request only).
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 3 of max 3.
**Sibling interfaces read:** [P2.4](../PHASE2_P2.4_APPROVAL_PAUSE.md), [P6.4](../../phase-6/PHASE6_P6.4_FAILURE_MODES.md).

Verdict: **not-ready** (round 3). Not ready after round 3; BINDING recorded under owner request (pt151u) with unresolved R3-F1, R3-F2.

## Round 1

Pass reviewed: 1. VERDICT: **not-ready**.

```
VERDICT: not-ready
BLOCKER  D2 — Notifications lost on reconnect — evidence: PHASE2_P2.3_STOP_INTERRUPT.md — fix: Re-read stop rows on reconnect
MAJOR    D3 — Graceful source unclear — evidence: PHASE2_P2.3_STOP_INTERRUPT.md — fix: Read pending rows at the boundary
```

### R1-F1. Notifications lost on reconnect

[HIGH] Notifications lost on reconnect
File: `PHASE2_P2.3_STOP_INTERRUPT.md` (D2)
Issue: LISTEN drops notifications sent while disconnected; pass 1 relied on them alone.
Fix: Re-read stop rows on reconnect.

### R1-F2. Graceful source unclear

[MEDIUM] Graceful source unclear
File: `PHASE2_P2.3_STOP_INTERRUPT.md` (D3)
Issue: Pass 1 kept a graceful message.
Fix: Read pending rows at the boundary.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | D2 amended (pass 2). |
| R1-F2 | fixed | D3 reads pending rows (pass 2). |

## Round 2

Pass reviewed: 2. VERDICT: **not-ready**.

```
VERDICT: not-ready
BLOCKER  D2 — Register/read race — evidence: PHASE2_P2.3_STOP_INTERRUPT.md — fix: Register before reading
MAJOR    D1 — Listener down = no stop — evidence: PHASE2_P2.3_STOP_INTERRUPT.md — fix: Poll fallback
```

### R2-F1. Register/read race

[HIGH] Register/read race
File: `PHASE2_P2.3_STOP_INTERRUPT.md` (D2)
Issue: A stop committed between the boundary read and step registration would be missed until the step ends.
Fix: Register before reading.

### R2-F2. Listener down = no stop

[MEDIUM] Listener down = no stop
File: `PHASE2_P2.3_STOP_INTERRUPT.md` (D1)
Issue: If the hub cannot LISTEN, stops wait until the step ends.
Fix: Poll fallback.

### Round 2 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R2-F1 | fixed | D2 says register then read (pass 3). |
| R2-F2 | fixed | D7 added (pass 3). |

## Round 3

Pass reviewed: 3. VERDICT: **not-ready**.

```
VERDICT: not-ready
MAJOR    D4 — Abort latency depends on the provider — evidence: PHASE2_P2.3_STOP_INTERRUPT.md — fix: Measure per provider; document the bound
MAJOR    D1 — NOTIFY fan-out unmeasured — evidence: PHASE2_P2.3_STOP_INTERRUPT.md — fix: Load test
MINOR    D3 — Extra step per loop — evidence: PHASE2_P2.3_STOP_INTERRUPT.md — fix: Fold into modelStep
```

### R3-F1. Abort latency depends on the provider

[MEDIUM] Abort latency depends on the provider
File: `PHASE2_P2.3_STOP_INTERRUPT.md` (D4)
Issue: Whether every ModelAdapter provider and every tool honours AbortSignal promptly is unmeasured; an ignoring provider keeps billing until timeout.
Fix: Measure per provider; document the bound.

### R3-F2. NOTIFY fan-out unmeasured

[MEDIUM] NOTIFY fan-out unmeasured
File: `PHASE2_P2.3_STOP_INTERRUPT.md` (D1)
Issue: One channel for all stops: payload rate at peak and listener lag are unknown [U].
Fix: Load test.

### R3-F3. Extra step per loop

[LOW] Extra step per loop
File: `PHASE2_P2.3_STOP_INTERRUPT.md` (D3)
Issue: checkStop adds a checkpoint per step.
Fix: Fold into modelStep.

### Round 3 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R3-F1 | deferred | Measurement owned by [P6.5](../../phase-6/PHASE6_P6.5_LOAD_CHAOS.md); worst case is the step timeout, same as today. Open. |
| R3-F2 | deferred | Owned by [P6.5](../../phase-6/PHASE6_P6.5_LOAD_CHAOS.md); poll fallback bounds latency. Open. |
| R3-F3 | rejected | Separate step keeps the boundary visible and the model step unchanged. |
