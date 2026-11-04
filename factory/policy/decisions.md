# Decisions

Human gates during design. Research first ([`indexing.md`](indexing.md) and the
reference notes), then **stop and ask**. Do not lock an important `D` silently.

Ticket implementers do not decide. If the design is silent, stop and report under
"Choices the design was silent on" ([`tickets.md`](tickets.md)).

## What is a gate

Ask only when the choice is expensive to reverse or changes the product:

1. A new unit, interface, message, or write path
2. Contradicts a BINDING design or `paths.product_contract` (amendment vs new law)
3. Mutability, deletion, eviction, or what "exists"
4. A security or trust boundary (untrusted input, secrets, who may call)
5. What we will not build (a real non-goal, a dropped scope)

Do **not** ask about naming nits, defaults the standards already set, Green-when
commands, ticket wording, or anything a BINDING design or the decision log froze.

## Where locks live

Product locks live in `paths.product_contract` and `paths.decision_log`.

- Do not reverse a lock from an indexing or ticket session.
- Before adding a **new** lock, stop and ask (the Q format below).
- A note's decision is not a lock until the human records it in one of those files.
- Do not mark BINDING from an index; design is a later session.

## How to ask

One stop, at most **five** questions, each:

```
Q<n>. <one sentence>
  A — <option>. Cost: <one line>
  B — <option>. Cost: <one line>
  Recommend: <A|B> because <one line of evidence, path:line or index>
Reply A, B, or a named third. Do not continue until you answer.
```

Bring researched options, never "what should we do?". Wait for an explicit pick; "looks
good" is not a pick for an unanswered Q.

## Research before asking

1. **Indexes first.** The router at `paths.index_root`; method in
   `paths.index_pattern`.
2. **Then source.** Open only the `path:line` anchors a note cites. On conflict with
   docs, source wins.
3. **Then ask**, stating how the source handles it, the index verdict (adopt, adapt, or
   ignore), and the implication for this project with two or three options.

## Architecture vs program design

Architecture gates are product `D`s (the list above). Program-design gates are
landing `PD`s: folder ownership, seam type, call-site shape, who constructs
whom. Do not ask a `PD` that reopens a locked `D`. Do not ask architecture `D`s
in the program pass.

Tickets are not a gate pass. Write `vocabulary.tickets_file` only after the
program sibling is BINDING ([`design.md`](design.md)).

## Where it sits in design

```
research (indexes → source)
        │
        ▼
  architecture gate  ← here until every product Q is answered
        │
        ▼
  write architecture spec  (each gated pick becomes a numbered D)
        │
        ▼
  spec-reviewer (architecture)
        │
        ▼
  architecture BINDING  ← human yes after a blocker-free review
        │
        ▼
  program-design gate  ← PD questions only
        │
        ▼
  write program spec  (each gated pick becomes a numbered PD)
        │
        ▼
  spec-reviewer (program)
        │
        ▼
  program BINDING  ← human yes; then the anexo pass
```

Do not write product code in this session. Do not mark either file BINDING
without a human yes after that file's review has no blockers. An agent may
record an explicit user instruction under
[`design.md`](design.md#user-authorized-binding-status); do not re-ask an
approval the user already supplied.

## Recording

In the architecture spec each gated pick is a `D#` stating the choice. In the
program spec, landing picks are `PD#`. The pass's changelog row records who
picked it and what was rejected and why ([`design.md`](design.md) § Editing a
spec). Do not hide a gate as prose in Overview.

## Parent must not

- Pick a gate "for now" and mention it later
- Batch 20 questions
- Re-ask a D the human already locked in this design
- Treat designer output as approved until the gates are confirmed
