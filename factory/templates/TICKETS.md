# <Unit {n}: title> — tickets and session prompts

Companion to the BINDING architecture spec and BINDING program spec, not a
replacement. Architecture owns the law and `D`s. Program design owns landing
(files, signatures, call graph, seams, call sites). This file owns the ticket
rows, the sequence, the file fences, the validation contract, and **one
paste-ready prompt per session**. Write this file only after the program
sibling is BINDING.

Resolve project paths, vocabulary, and commands from `config.yaml`. Cite command
keys with their required scope arguments; include resolved commands only when
the design needs to pin them. Use the same checks in the ticket table and its
SESSION. An empty command does not exist: omit optional checks that are not
configured, and report missing required checks or sources as blockers.

This is an authoring template. Replace placeholders and comments before execution
or a requested review.
[Ticket policy](../policy/tickets.md) owns execution and review levels;
[design policy](../policy/design.md) owns prerequisites and grandfathering;
[review policy](../policy/review.md) owns optional anexo review, which runs
only on request. No review verdict is required before execution; the anexo
is not itself marked BINDING. All execution prerequisites still apply.

Copy **one SESSION block** into a **new agent session**. Do not paste two tickets
into one chat. Do not resume a previous ticket's chat. No code lands with this
file. To run the anexo without pasting: a new chat with `run tickets <this file>`
(skill `ticket-orchestrator`); that parent still launches one fresh subagent per
SESSION.

If the architecture or program spec is ambiguous or you believe it is wrong,
**stop and report**. Do not resolve it and do not invent a variant.

**Last ticket is always remove complexity.** Feature work is tickets 1..N−1.
Ticket N reads the slice just landed, hunts, and
removes complexity (agent `complexity-remover`, `ponytail` `ultra`). It adds no behavior
and no public API, and it does **not** fix failures owned by tickets 1..N−1: it
stops and names the owner. Never loosen asserts, delete tests, or rewrite the slice
to green the close.

## Delivery explained

Before the tables, explain the delivery in a few short, connected paragraphs.
State what becomes usable when the sequence finishes. Walk through how the
intermediate tickets build toward that result, and explain why their order
matters. Name the final integration point and any prerequisite that can block
it. Link the architecture and program explanations instead of repeating them.

A reader should understand what the sequence delivers before learning file
fences or validation ids. Distinguish planned work from completed work; the
orchestrator's Progress block is the execution record.

## Prerequisite

<!-- Link the BINDING siblings and prerequisite units/tickets. State the concrete
     files, interfaces, tools, or fixtures earlier work must provide. Record the
     path base used below. Identify missing required commands or policy sources;
     do not invent them. Use only documented grandfathering when applicable. -->

## Sequence

```
1 -> 2 -> N
```

<!-- Default to serial execution. Explain dependencies and shared files, including
     exports, build metadata, fixtures, and contract tests. Mark tickets parallel
     only when their writes and prerequisites are independent. Parallel dispatch
     additionally requires the human to name those disjoint tickets under the
     orchestrator rules. Never two agents on one unit at once. -->

## Tickets

| # | Ticket | Files it may edit | Green when |
|---|--------|-------------------|------------|
| 1 | | | |
| N | Remove complexity from the landed slice. No new behavior. | Only files this unit already edited | Configured gates + scoped tests, then the stack's close suite |

Each feature ticket names an observable outcome, its architecture/program ids,
and its test unit. Give precise allowed files; broader directories need a
reason. A ticket must be testable using interfaces and fixtures available by
its end. It must not call an operation first introduced by a later ticket.
Keep tests for a behavior with the ticket that introduces it. Tables and
SESSION blocks must agree on scope, prerequisites, and Green-when checks.
Expand the feature SESSION pattern once per feature ticket. Replace `N` with
the actual final ticket number throughout the finished anexo.

## Validation contract

Written in the **anexo pass, before any code**. Each row is a way to break one
numbered law, `D`, or `PD`. Each ticket's tests and Green-when exercise the
rows it owns (`cmd` in the permitted test file). There is no separate validator
agent. At `full`, `code-reviewer` (and optional hunters) review the diff after
green; the parent may additionally attack V-rows manually if needed.

| V# | Attacks | Kind | Attack | Observable failure | Owner |
|----|---------|------|--------|--------------------|-------|
| V1 | law / D / PD id | `cmd` \| `probe` \| `read` | what the validator does to break it | the exact outcome that means "broken" | first ticket after which it must hold |

- **Kinds.** `cmd`: a command with an expected exit (test file, import-boundary
  fence, `rg` ban). `probe`: a throwaway scenario written and run inside the
  snapshot; it never enters the real tree. `read`: a claim checked against
  `path:line`; use only when there is no runtime observable.
- **Coverage.** Every numbered law, `D#`, and `PD#` appears in at least one row,
  or under **Not attackable** with a specific reason. Attack numeric bounds on
  both sides, including the boundary itself when relevant.
- **Cumulative.** After ticket N, every row owned by a ticket ≤ N holds. Name
  the earliest owner whose files and fixtures make the check possible. If an
  expectation changes by stage, state those stages explicitly or split the row.
- **Each row needs teeth** (review failures seen in practice, `policy/review.md`):
  - It has an accepted baseline and a rejected near-miss where those concepts
    apply. A check that only feeds bad input passes an implementation that
    rejects everything. For a static or structural rule, name the valid form
    and the forbidden change the check must distinguish.
  - The failing input differs from the passing one in exactly the attacked way.
  - When a check typechecks or compiles a scratch file, that file is inside
    the tool's input set. Otherwise the check cannot observe the violation.
  - Every tool it runs exists in the repo or its pinned image.
  - The session that owns it builds the fixture the row needs.
  - It does not contradict a later ticket's allowed output.

Specify the working directory, command or probe, required fixture, and expected
observable precisely enough for another agent to reproduce the check. Distinguish
the tested program's failure from the test command's success: an invalid input
may exit nonzero while the test proving rejection exits zero. For an `rg` ban,
state the expected no-match exit and distinguish it from a tool error. Do not
call an absent tool or an out-of-scope scratch file a successful check.

**Not attackable:** <!-- ids + one-line reason each, or "none" -->

## Progress

Updated by the **implementer** or **complexity-remover** when the ticket finishes
(`policy/tickets.md` § Progress settlement). The orchestrator may correct a
mistake; it does not replace settlement. Other agents do not edit this block.

| # | State | Attempts | Verifier | Handoff |
|---|-------|----------|----------|---------|
| 1 | PENDING | 0 | — | — |
| N | PENDING | 0 | — | — |

Handoffs are stored at `<paths.runs>/<anexo-stem>/ticket-<N>.md`.

### Anchor

<!-- Rewritten by the orchestrator after every ticket. Merge only the new handoff. -->
- **Intent:** <!-- design + what this anexo delivers, one line -->
- **Files touched so far:** <!-- cumulative -->
- **Decisions:** <!-- silent choices a human `continue`d, with ticket # -->
- **Open issues → owner / Next:** <!-- issue → ticket or design; next ticket -->

## Fences every ticket runs

Use the project's stack ticket rules, profile testing rules, and configured
commands. If a required source is missing, record the gap for resolution before
execution; do not borrow another stack's gates. Name the scope argument for
each edited test unit and any ticket-specific checks. Keep command keys and
arguments consistent across the table, shared fences, and SESSION blocks.
State expected exits for checks intentionally exercising rejection.

Do **not** run `commands.test_all` except on the last ticket. Do **not** run
another unit's tests unless that unit is in the fence. A fence written to fail
(an `rg` ban that must find nothing) passes when it reports nothing; do not
weaken the pattern.

## Unit close (ticket N only)

After the remove-complexity diff run the gates and scoped tests, then
the stack's close suite, including `commands.test_all` and any integration rows
the anexo saved for close. Run `commands.setup_integration` only when configured
and needed by those checks. If a required close command is unavailable, report
the blocker rather than inventing or silently skipping it. A failure that does
not come from the remove-complexity diff: stop and report the owning ticket.

## What no ticket may do

<!-- Hard bans from the design (law, dropped scope, import-boundary leaks). -->

---

## SESSION 1 — Ticket 1: <short name>

```
You are implementing an already-locked design. This is not a redesign.

Architecture: <path under paths.designs> (BINDING).
Program: <path of vocabulary.program_file> (BINDING).
Anexo: <path of this tickets file>.
Allowed edits: <exact files from this ticket's table row>.
This session is ticket 1 only. Stop when it is green. Do not start later tickets.
Do not edit the design files. Do not touch folders this ticket does not name.

## Session brief (read first)

`<paths.runs>/<anexo-stem>/ticket-<N>-brief.md` under the repo root (resolve to
an absolute path). If missing, run from repo root:
`python3 factory/cli.py bundle-session --anexo <same path as Anexo line above> --session <N>`
then read the path it prints.

After this anexo is written or amended, the parent runs
`python3 factory/cli.py bundle-session --anexo <Anexo path> --all`.

## Read before writing code, in this order

Items 1–3 are satisfied by the session brief; do not re-read the whole kit.

1. (brief) Repo rules, layering, code style, profile testing, stack ticket rules,
   implementation checklist, and skill entrypoint paths.
2. (brief) Memory index when present; follow `policy/reading.md` for spec slices.
3. (brief) Skill routers only; load `reference.md` files on demand.
4. Read the BINDING architecture ids this ticket lands and the matching program
   slices: files, signatures, flow, seams, and call sites. Use the exact ids
   and section links supplied below; do not load whole sibling specs.
5. Read this anexo's Progress Anchor and your ticket row from disk. If Attempts
   is at least 1, read <paths.runs>/<anexo-stem>/ticket-<N>.md for the previous
   attempt before implementing. Read nothing else from that directory.
6. <named source files, relevant spec slices, and prerequisite interfaces>

## This ticket lands

<!-- State the end-of-ticket behavior and the D/law/PD ids it implements.
     Name exact program-owned files, operations, and fixtures. Include every
     prerequisite and restriction needed by a fresh agent with no chat history. -->

## Rules specific to this ticket

<!-- What this ticket must not do, even if a later ticket will. -->

## Green when

Run these before reporting green. Do not substitute a broader or thinner suite.

<!-- List the required configured gates from the project's ticket rules.
     Name commands.test_scope with the explicit unit argument for each edited
     test unit and any checks this ticket owns. Include working directories
     and expected exit codes. Do not include empty optional commands. -->
Do not run the full suite. Do not run tests for units this ticket does not name.

## Report

End with these four headings, in this order:
### Done                (what landed, files touched, commands and exit codes)
### Not done            (includes any Green-when command that failed, with its exit code)
### Choices the design was silent on   (or "none")
### Discovered issues   (each -> owner: ticket #, design, or pre-existing)
```

---

## SESSION N — Ticket N: remove complexity

Run by the `complexity-remover` agent, not `implementer`. The method (hunt,
then cut at `ponytail` `ultra`) lives in that agent. This block gives scope
only.

```
Architecture: <path under paths.designs> (BINDING).
Program: <path of vocabulary.program_file> (BINDING).
Anexo: <path of this tickets file>.
Allowed edits: <exact files from the landed slice>.
Spec slices: <architecture ids and program section links for this slice>.
This session is ticket N only: the remove-complexity pass. Stop when it is green.
Do not start other tickets. Do not edit the design files.

Resolve the kit config. Read paths.repo_rules first, then <kit>/policy/memory.md
and <kit>/policy/reading.md. Read the named architecture/program slices and this
anexo's Unit close section, Progress Anchor, and your ticket row from disk.
Unit files: <the files tickets 1..N−1 edited>.
Diff base: <immutable revision immediately before ticket 1's changes>.

Change only the named landed files. Add no behavior or public API. Do not fix
failures owned by earlier tickets: stop and report the owner. Never loosen
assertions or delete tests to make close pass.

## Green when

<!-- Required configured gates and scoped tests, then the stack's close suite.
     Include commands.test_all; include commands.setup_integration only when
     configured and required. Named cumulative validation obligations still hold. -->

## Report

End with these four headings, in this order:
### Done                (changes, files touched, commands and exit codes)
### Not done            (failed checks and exit codes; distinguish earlier failures)
### Choices the design was silent on   (or "none")
### Discovered issues   (each -> owner: ticket #, design, or pre-existing)
```
