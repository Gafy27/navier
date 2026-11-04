---
name: explaining-design-problems
description: >
  Writes a software-design problem packet so another agent can propose or
  implement a solution without inheriting a hidden design. Use when handing a
  design question to a subagent, Task, specialist, or later session; when the
  user says explain the problem, brief another agent, problem packet, solver
  brief, or design handoff. Do not use when the fix is already known, when
  brainstorming with the human, or when the job is to pick and implement an
  approach rather than explain the problem.
license: Apache-2.0
metadata:
  author: juan
  version: "1.0"
---

# Explaining design problems to other agents

Produce a **problem packet**: enough truth for a solver agent to work, not a
preferred design dressed up as a question.

The solver does not share this conversation. If a fact is not in the packet or
in a cited file, it does not exist.

## When to use

- Spawn a subagent / Task / specialist to **solve** a design or architecture question
- Brief a later session so it can bring options, not continue a hidden plan
- The user asks to explain a problem, write a brief, or hand off a design question

**Do not use** when: the change is a known fix; you are designing *with* the
human (brainstorming / SDD explore); you are the solver.

## Critical rules

0. **Introduction first. Mandatory. Never skip.** The packet MUST open with
   `## Introduction` before Goal. A solver who has never seen this repo or
   conversation must understand the situation from those paragraphs alone.
   If Introduction is missing, empty, or TBD, the packet is invalid — do not
   hand it off. Write 1–3 short paragraphs: what this part of the system is,
   what is going wrong (or what decision is blocked), why that matters, who
   or what is affected. Still no mechanism. No proposed types, crates, or
   "we should".
1. **Outcome, not mechanism.** Goal = what must be true after. Never "add an
   X so that Y" unless X is a hard constraint (existing API, compliance, already
   shipped contract).
2. **Do not smuggle the solution.** If the packet still works after deleting
   every proposed type, crate, algorithm, and file-to-create, it is a problem.
   If not, rewrite.
3. **Pointers, not dumps.** Cite 3–10 repo anchors with *why*. Do not paste
   large code or chat history.
4. **Facts vs assumptions vs unknowns.** Label each. Unlabeled text is treated
   as fact and will mislead the solver.
5. **Constraints vs preferences.** A constraint names what breaks if violated.
   A preference does not; put it under Preferences or drop it.
6. **Oracle = how you will check, not how to build.** "A test that replays the
   duplicate event enqueues once" is an oracle. "Use a unique constraint" is a
   design.

## Procedure

1. **Read before writing.** Open the code, tests, and project rules that bound
   the problem. Do not guess current behavior.
2. **Separate** symptoms, invariants, and open questions.
3. **Fill** [assets/problem-packet.md](assets/problem-packet.md). Write
   Introduction first. Skip other empty sections; never skip or TBD
   Introduction.
4. **Self-check** against the checklist below. Fix the packet, not the prose.
5. **Hand off** with the envelope below. The packet is the prompt body.

## Handoff envelope

Pass the filled packet as the specialist's entire task. Prefix with:

```
You are the solver, not the problem author. You did not see the prior
conversation. Treat the packet as the spec of the PROBLEM.

Read ## Introduction first, then the rest of the packet.
Do not assume a design unless it is listed under Constraints.
Read every Repo anchor before proposing anything.
Return exactly the Return shape. If a required fact is missing, list it
under Blocked — do not invent it.
```

Return shape (pick one, state it in the packet):

| Ask the solver for | Return |
| --- | --- |
| Options | 2–3 approaches, trade-offs, one recommendation, open questions |
| A decision | Recommended approach + what would change the call |
| An implementation | Plan then code; stop if a constraint is underspecified |

**Intent, context, return path** must all be present. Missing any one drops work
or duplicates it.

## Quality checklist (before spawn)

- [ ] `## Introduction` is the first section (after the title)
- [ ] Introduction is 1–3 paragraphs: system, what is wrong, why it matters
- [ ] Introduction contains no proposed design
- [ ] Goal is one sentence and names an outcome
- [ ] Non-goals fence helpful creativity
- [ ] Every constraint fails a "what breaks?" test
- [ ] Authority order is explicit
- [ ] Anchors are real paths the solver can open
- [ ] Assumptions are labeled; unknowns are questions, not fake facts
- [ ] Oracle is checkable without prescribing the design
- [ ] No recommended architecture in the packet unless it is a Constraint
- [ ] Return shape is one of: options / decision / implementation
- [ ] Secrets, tokens, and PII are absent (point at where they live)

## Anti-patterns

| Don't | Do |
| --- | --- |
| "Use a queue + outbox like we discussed" | Goal + constraints; let the solver choose |
| Paste the whole module | `path:line` + one-line why |
| "Make it more reliable / cleaner / scalable" | Name the failure mode and the check |
| Mix "must" with "nice" | Constraints vs Preferences |
| Hide a chosen design in acceptance criteria | Check the effect, not the mechanism |
| Dump the chat log | Curate facts the solver cannot recover from files |
| Start at Goal with no scene-setting | Open with Introduction a cold agent can use |
| TBD / skipped Introduction | Invalid packet — rewrite before spawn |

## Example (shape only)

**Bad:** "Add a Redis idempotency key in the webhook handler so retries don't
double-charge. Write the helper in `idempotency.rs`."

**Good:** Introduction: partners POST webhooks; we validate, persist, and
enqueue downstream work. They retry on timeout, so the same delivery can
arrive twice and we currently enqueue twice — double side effects in prod.
Goal: partner retries of the same delivery must not cause a second
downstream side effect. Non-goals: no new datastore; no partner-facing response
change. Constraint: p99 of the HTTP handler must not grow with retry policy.
Oracle: two deliveries with the same partner+event id enqueue work once.
Anchors: the handler, the existing retry helper, the error type enum.

Copy the template: [assets/problem-packet.md](assets/problem-packet.md).
