# Existing roles with explicit workflow contracts

Two fresh agents received the same three-task request with isolated copies
of the same Python fixture. One received the previous indexing/research/
implementer instructions; the other received their revised counterparts.
Saved instruction snapshots, request, reports, baseline outputs, and proof
scripts are beside this file. No production code was changed by the runs.

## Pass conditions and observations

| Case / criterion | Previous instructions | Revised instructions |
|------------------|-----------------------|----------------------|
| Explain the duplicate key with correct source citations | ID key and first occurrence described | ID key and first occurrence described |
| Do not invent author intent without history | Explicitly unknown | Explicitly unknown |
| Demonstrate export omission before fixing | Saved failing reproduction, exit 1 | Saved failing reproduction, exit 1 |
| Export every row with exact separators after fixing | Empty/single/multiple cases pass | Empty/single/multiple cases pass |
| Capture labels baseline before refactoring; compare negative/zero/positive inputs | Baseline and comparison retained | Baseline, original source, and comparison retained |
| Preserve unrelated deduplication behavior | Probe passes | Probe passes |
| Keep work inside the assigned scratch project | Expected artifacts and bytecode cache only | Expected artifacts and bytecode cache only |
| Handoff has explicit completion, missing work, choices, issues fields | Narrative report includes checks and limits | Uses Done / Not done / Choices the design was silent on / Discovered issues |
| Unnecessary questions or unsupported approval claims | None in returned handoff | None in returned handoff |

The parent inspected reports and baseline logs, then reran each saved
`check_records.py` in its own project directory. Both exited 0. These
checks cover the fixture, not Cosmos or every possible Python object.

## What stays and what was cut

- Keep numbered execution and explicit stops inside existing owners. No
  parallel playbook directory or second router was added.
- Keep compact successful receipts and explicit unverified work in the
  implementer handoff; the revised run produced those fixed fields.
- Research delegates sequencing and output fields to indexing; remove its
  duplicate ready checklist rather than adding another one.
- Replace the reviewer's unsupported numerical-confidence threshold with
  evidence and a concrete failing case. Replace its full-file instruction
  with the existing sliced-reading policy. These are consistency/clarity
  cuts, not measured improvements from this pilot.

## Limits

One run per variant is not enough to establish a quality or speed gain.
Both agents already behaved correctly. No token/cost or reliable elapsed
time measurements were collected. Agents were fresh, but shared the same
model selection inherited from the parent; actual backend version/effort
was not recorded. Request names exposed old/revised directory labels, so
this was not a fully blinded experiment.

The request itself asked for before/after proof, making this a compatibility
and handoff check rather than strong evidence that the new instructions
cause better behavior. Three tasks shared each candidate's context. Factory
fixture prerequisites and live-web requirements were explicitly waived.
No real indexing note/router, designer pass, or code review was exercised.
The stopped CLI reviewer was not restarted or replaced by these runs.

Readiness to keep the format comes from the user's requested contract and
this limited compatibility check. Do not describe it as a measured
correctness, throughput, or token-saving improvement.
