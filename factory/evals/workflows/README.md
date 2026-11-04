# Workflow instruction pilot

Small, manual comparisons of instruction changes. Not startup reading and
not a new review or ticket gate. Run when changing workflow instructions;
do not create a panel or repeat a passing pilot on every product change.

## Procedure

1. Choose a few real failure modes and write observable pass conditions
   before running. Use private fixtures with no service credentials.
2. Copy identical inputs into isolated directories. Give fresh agents the
   same request, one with the old instructions and one with the revision.
   Keep the scoring criteria out of their prompts. Record model/context
   differences; do not treat an agent's account as proof of its actions.
3. Inspect output files, run executable checks, and verify citations.
   Compare unsupported claims, real checks performed, unnecessary questions,
   scope violations, and handoff completeness. Record time/tokens only when
   measurements are available.
4. Keep only useful instruction changes. Prefer editing an existing owner
   over adding another workflow file. Remove duplicate sequences and rules
   that ask for unsupported self-reported confidence. Record inconclusive
   results rather than claiming improvement.

Use existing role output formats; no extra per-step status recital or
mandatory decision log. For a rerun, use the saved request and source in
separate scratch directories. Explicit fixture overrides do not authorize
production changes or change factory's design gates.

## Runs

| Run | Scope | Result |
|-----|-------|--------|
| [2026-10-15](2026-10-15/RESULTS.md) | Investigation, bug fix, behavior-preserving refactor | Both variants pass the bounded behavior checks. Revised handoff uses fixed fields. Correctness/performance benefit is inconclusive. |
