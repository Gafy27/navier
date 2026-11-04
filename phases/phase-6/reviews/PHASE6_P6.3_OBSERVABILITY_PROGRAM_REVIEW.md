# P6.3 program review — Traces, metrics and alerts

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE6_P6.3_OBSERVABILITY_PROGRAM.md`](../PHASE6_P6.3_OBSERVABILITY_PROGRAM.md) (kind `program`), passes 1–2; read against BINDING architecture [`PHASE6_P6.3_OBSERVABILITY.md`](../PHASE6_P6.3_OBSERVABILITY.md).
**Not reviewed:** the anexo (on request only) and architecture clauses this program does not land.
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 2 of max 3.
**Sibling interfaces read:** [P6.1](../PHASE6_P6.1_WORKER_DEPLOYMENT.md) program.

Verdict: **ready** (round 2). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
MAJOR    PD1 — No metrics exporter exists — evidence: PHASE6_P6.3_OBSERVABILITY_PROGRAM.md — fix: Emit as OTLP metrics via the same collector or as structured log lines
```

### R1-F1. No metrics exporter exists

[MEDIUM] No metrics exporter exists
File: `PHASE6_P6.3_OBSERVABILITY_PROGRAM.md` (PD1)
Issue: Navier `src` has logs but no metrics exporter.
Fix: Emit as OTLP metrics via the same collector or as structured log lines.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | PD1: structured log lines first, OTLP metrics later (pass 2). |

## Round 2

Pass reviewed: 2. VERDICT: **ready**.

```
VERDICT: ready
(no findings)
```

### Round 2 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| — | — | No findings. |
