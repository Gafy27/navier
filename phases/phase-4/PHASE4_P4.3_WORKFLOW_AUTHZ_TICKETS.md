# P4.3 Identity propagation and checks inside DBOS steps — tickets and session prompts

Companion to the BINDING architecture spec [`PHASE4_P4.3_WORKFLOW_AUTHZ.md`](PHASE4_P4.3_WORKFLOW_AUTHZ.md) and BINDING program spec [`PHASE4_P4.3_WORKFLOW_AUTHZ_PROGRAM.md`](PHASE4_P4.3_WORKFLOW_AUTHZ_PROGRAM.md), not a replacement. Architecture owns the law and `D`s. Program design owns landing. This file owns the ticket rows, the sequence, the file fences, the validation contract, and one paste-ready prompt per session. It is not BINDING and needs no review verdict to run (anexo review only on request).

Copy **one SESSION block** into a **new agent session**. Do not paste two tickets into one chat. Do not resume a previous ticket's chat. No code lands with this file. To run the anexo without pasting: a new chat with `run tickets phases/phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ_TICKETS.md` (skill `ticket-orchestrator`).

If the architecture or program spec is ambiguous or you believe it is wrong, **stop and report**. Do not resolve it and do not invent a variant.

**Last ticket is always remove complexity.** Feature work is tickets 1..3. Ticket 4 is run by `complexity-remover` at `ponytail` `ultra`; it adds no behavior and does not fix failures owned by earlier tickets.

## Delivery explained

When done, with `AUTHZ_MODE=engine` tool calls, decisions and posts check inside their own transactions and DBOS holds no identity.

## Prerequisite

[P4.2](PHASE4_P4.2_NAVIER_MODEL.md), [P2.2](../phase-2/PHASE2_P2.2_STEPS_RETRIES.md), [P2.4](../phase-2/PHASE2_P2.4_APPROVAL_PAUSE.md) tickets.

**Gates today.** Every `commands.*` code gate is empty in `factory/config.yaml`, so every Green-when line below is **unavailable** here: tickets run in the Navier repository once its `package.json` scripts fill the config [U]. An implementer that finds a gate empty reports the ticket blocked, never green (`factory/profile/navier_dbos/tickets.md`).

## Sequence

```
1 -> 2 -> 3 -> 4
```

Serial. Each ticket builds on the files and exports the previous one landed.

## Tickets

| # | Ticket | Files it may edit | Green when |
|---|--------|-------------------|------------|
| 1 | Engine adapter and error mapping (D2, D7, D8, PD1) | `src/authz/engine/adapter.ts`<br>`src/authz/engine/errors.ts`<br>`src/authz/engine/adapter.test.ts` | gates + `commands.test_scope` `src/authz/engine` (unavailable today) |
| 2 | Principal loader and tool-call check in claim tx (D1, D3, PD2) | `src/runtime/steps.ts`<br>`src/runtime/tool-call.ts`<br>`src/runtime/tool-call.test.ts` | gates + `commands.test_scope` `src/runtime` (unavailable today) |
| 3 | Decide and post checks in their transactions (D4, D5) | `src/runtime/decide.ts`<br>`src/runtime/post.ts`<br>`src/runtime/edge.ts` | gates + `commands.test_scope` `src/runtime` (unavailable today) |
| 4 | Remove complexity from the landed slice. No new behavior. | Only files tickets 1..3 edited | gates + scoped tests, then `commands.test_all` (unavailable today) |

## Validation contract

| V# | Attacks | Kind | Attack | Observable failure | Owner |
|----|---------|------|--------|--------------------|-------|
| V1 | D7 | cmd | engine returns AZ001 | allow | 1 |
| V2 | D1 | cmd | `select inputs, output from dbos.workflow_status` after S1–S12 | principal id present | 2 |
| V3 | D3 | cmd | revoke invoke, then tool call | tool executes | 2 |
| V4 | D4 | cmd | non-owner decides | decision written | 3 |

**Not attackable:** Shadow mode ([P4.4](PHASE4_P4.4_AUTHZ_CUTOVER.md)).

## Progress

Updated by the **implementer** or **complexity-remover** when the ticket finishes (`policy/tickets.md` § Progress settlement).

| # | State | Attempts | Verifier | Handoff |
|---|-------|----------|----------|---------|
| 1 | PENDING | 0 | — | — |
| 2 | PENDING | 0 | — | — |
| 3 | PENDING | 0 | — | — |
| 4 | PENDING | 0 | — | — |

Handoffs are stored at `.agents/harness/runs/PHASE4_P4.3_WORKFLOW_AUTHZ_TICKETS/ticket-<N>.md`.

### Anchor

- **Intent:** land P4.3 Identity propagation and checks inside DBOS steps per the BINDING program; 3 feature tickets + complexity close.
- **Files touched so far:** none (no ticket has run).
- **Decisions:** none.
- **Open issues → owner / Next:** code gates unavailable → Navier repo config; next ticket 1.

## Fences every ticket runs

TypeScript stack rules (`factory/stack/typescript/tickets.md`): `commands.typecheck`, `lint`, `format`, `deps` (skip any the config leaves empty **only after the Navier repo fills them**; today all are empty and the ticket is blocked), then `commands.test_scope` for each workspace folder in Files it may edit. Do **not** run `commands.test_all` except on ticket 4. Do **not** run another unit's tests. An `rg` ban passes when it reports nothing (exit 1 = no match; exit 2 = tool error, which fails).

## Unit close (ticket 4 only)

After the remove-complexity diff run the gates and scoped tests, then `commands.test_all`. `commands.setup_integration` only when a V-row saved for close needs it (unavailable until the P1.5 harness lands). If a required close command is unavailable, report the blocker rather than skipping it.

## What no ticket may do

- Edit `src/runner/temporal/` (frozen adapter, P1.3) or `src/llm/` (owner decision 2) unless this ticket's fence names it.
- Put text, request context, tool arguments, outputs or credentials into a workflow input, step output, DBOS message or event (P2.1 L2).
- Edit any `PHASE*.md` design file, a review file, or `factory/`.

---

## SESSION 1 — Ticket 1: Engine adapter and error mapping

```
You are implementing an already-locked design. This is not a redesign.

Architecture: phases/phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ.md (BINDING).
Program: phases/phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ_PROGRAM.md (BINDING).
Anexo: phases/phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ_TICKETS.md.
Allowed edits: src/authz/engine/adapter.ts, src/authz/engine/errors.ts, src/authz/engine/adapter.test.ts.
This session is ticket 1 only. Stop when it is green. Do not start later tickets.
Do not edit the design files. Do not touch folders this ticket does not name.

## Session brief (read first)

`.agents/harness/runs/PHASE4_P4.3_WORKFLOW_AUTHZ_TICKETS/ticket-1-brief.md` under the repo root (resolve to an absolute path). If missing, run from repo root:
`python3 factory/cli.py bundle-session --anexo phases/phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ_TICKETS.md --session 1`
then read the path it prints.

After this anexo is written or amended, the parent runs
`python3 factory/cli.py bundle-session --anexo phases/phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ_TICKETS.md --all`.

## Read before writing code, in this order

Items 1–3 are satisfied by the session brief; do not re-read the whole kit.

1. (brief) Repo rules, layering, code style, profile testing, stack ticket rules, implementation checklist, and skill entrypoint paths.
2. (brief) Memory index when present; follow `policy/reading.md` for spec slices.
3. (brief) Skill routers only (`ticket-testing` included); load `reference.md` files on demand.
4. Read the BINDING architecture ids and program slices this ticket lands: D2, D7, D8, PD1.
5. Read this anexo's Progress Anchor and ticket row 1 from disk. If Attempts is at least 1, read .agents/harness/runs/PHASE4_P4.3_WORKFLOW_AUTHZ_TICKETS/ticket-1.md first. Read nothing else from that directory.
6. Named sources: none beyond the program slices.

## This ticket lands

Adapter.

## Rules specific to this ticket

Do not add behavior a later ticket owns. Do not change exported names the program fixes.

## Green when

Run these before reporting green. Do not substitute a broader or thinner suite.

- `commands.typecheck` — exit 0. **Unavailable today** (empty in `factory/config.yaml`): report blocked, not green.
- `commands.lint` — exit 0. **Unavailable today**.
- `commands.format` — exit 0. **Unavailable today**.
- `commands.deps` — exit 0. **Unavailable today**.
- `commands.test_scope` with `{unit}` = `src/authz/engine` — exit 0. **Unavailable today**.
- Validation rows owned by ticket 1: V1 (exercised by this ticket's tests).
Do not run the full suite. Do not run tests for units this ticket does not name.

## Report

End with these four headings, in this order:
### Done                (what landed, files touched, commands and exit codes)
### Not done            (includes any Green-when command that failed or was unavailable, with its exit code)
### Choices the design was silent on   (or "none")
### Discovered issues   (each -> owner: ticket #, design, or pre-existing)
```

---

## SESSION 2 — Ticket 2: Principal loader and tool-call check in claim tx

```
You are implementing an already-locked design. This is not a redesign.

Architecture: phases/phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ.md (BINDING).
Program: phases/phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ_PROGRAM.md (BINDING).
Anexo: phases/phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ_TICKETS.md.
Allowed edits: src/runtime/steps.ts, src/runtime/tool-call.ts, src/runtime/tool-call.test.ts.
This session is ticket 2 only. Stop when it is green. Do not start later tickets.
Do not edit the design files. Do not touch folders this ticket does not name.

## Session brief (read first)

`.agents/harness/runs/PHASE4_P4.3_WORKFLOW_AUTHZ_TICKETS/ticket-2-brief.md` under the repo root (resolve to an absolute path). If missing, run from repo root:
`python3 factory/cli.py bundle-session --anexo phases/phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ_TICKETS.md --session 2`
then read the path it prints.

After this anexo is written or amended, the parent runs
`python3 factory/cli.py bundle-session --anexo phases/phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ_TICKETS.md --all`.

## Read before writing code, in this order

Items 1–3 are satisfied by the session brief; do not re-read the whole kit.

1. (brief) Repo rules, layering, code style, profile testing, stack ticket rules, implementation checklist, and skill entrypoint paths.
2. (brief) Memory index when present; follow `policy/reading.md` for spec slices.
3. (brief) Skill routers only (`ticket-testing` included); load `reference.md` files on demand.
4. Read the BINDING architecture ids and program slices this ticket lands: D1, D3, PD2.
5. Read this anexo's Progress Anchor and ticket row 2 from disk. If Attempts is at least 1, read .agents/harness/runs/PHASE4_P4.3_WORKFLOW_AUTHZ_TICKETS/ticket-2.md first. Read nothing else from that directory.
6. Named sources: none beyond the program slices.

## This ticket lands

Tool.

## Rules specific to this ticket

Do not add behavior a later ticket owns. Do not change exported names the program fixes.

## Green when

Run these before reporting green. Do not substitute a broader or thinner suite.

- `commands.typecheck` — exit 0. **Unavailable today** (empty in `factory/config.yaml`): report blocked, not green.
- `commands.lint` — exit 0. **Unavailable today**.
- `commands.format` — exit 0. **Unavailable today**.
- `commands.deps` — exit 0. **Unavailable today**.
- `commands.test_scope` with `{unit}` = `src/runtime` — exit 0. **Unavailable today**.
- Validation rows owned by ticket 2: V2, V3 (exercised by this ticket's tests).
Do not run the full suite. Do not run tests for units this ticket does not name.

## Report

End with these four headings, in this order:
### Done                (what landed, files touched, commands and exit codes)
### Not done            (includes any Green-when command that failed or was unavailable, with its exit code)
### Choices the design was silent on   (or "none")
### Discovered issues   (each -> owner: ticket #, design, or pre-existing)
```

---

## SESSION 3 — Ticket 3: Decide and post checks in their transactions

```
You are implementing an already-locked design. This is not a redesign.

Architecture: phases/phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ.md (BINDING).
Program: phases/phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ_PROGRAM.md (BINDING).
Anexo: phases/phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ_TICKETS.md.
Allowed edits: src/runtime/decide.ts, src/runtime/post.ts, src/runtime/edge.ts.
This session is ticket 3 only. Stop when it is green. Do not start later tickets.
Do not edit the design files. Do not touch folders this ticket does not name.

## Session brief (read first)

`.agents/harness/runs/PHASE4_P4.3_WORKFLOW_AUTHZ_TICKETS/ticket-3-brief.md` under the repo root (resolve to an absolute path). If missing, run from repo root:
`python3 factory/cli.py bundle-session --anexo phases/phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ_TICKETS.md --session 3`
then read the path it prints.

After this anexo is written or amended, the parent runs
`python3 factory/cli.py bundle-session --anexo phases/phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ_TICKETS.md --all`.

## Read before writing code, in this order

Items 1–3 are satisfied by the session brief; do not re-read the whole kit.

1. (brief) Repo rules, layering, code style, profile testing, stack ticket rules, implementation checklist, and skill entrypoint paths.
2. (brief) Memory index when present; follow `policy/reading.md` for spec slices.
3. (brief) Skill routers only (`ticket-testing` included); load `reference.md` files on demand.
4. Read the BINDING architecture ids and program slices this ticket lands: D4, D5.
5. Read this anexo's Progress Anchor and ticket row 3 from disk. If Attempts is at least 1, read .agents/harness/runs/PHASE4_P4.3_WORKFLOW_AUTHZ_TICKETS/ticket-3.md first. Read nothing else from that directory.
6. Named sources: none beyond the program slices.

## This ticket lands

Decide.

## Rules specific to this ticket

Do not add behavior a later ticket owns. Do not change exported names the program fixes.

## Green when

Run these before reporting green. Do not substitute a broader or thinner suite.

- `commands.typecheck` — exit 0. **Unavailable today** (empty in `factory/config.yaml`): report blocked, not green.
- `commands.lint` — exit 0. **Unavailable today**.
- `commands.format` — exit 0. **Unavailable today**.
- `commands.deps` — exit 0. **Unavailable today**.
- `commands.test_scope` with `{unit}` = `src/runtime` — exit 0. **Unavailable today**.
- Validation rows owned by ticket 3: V4 (exercised by this ticket's tests).
Do not run the full suite. Do not run tests for units this ticket does not name.

## Report

End with these four headings, in this order:
### Done                (what landed, files touched, commands and exit codes)
### Not done            (includes any Green-when command that failed or was unavailable, with its exit code)
### Choices the design was silent on   (or "none")
### Discovered issues   (each -> owner: ticket #, design, or pre-existing)
```

---

## SESSION 4 — Ticket 4: remove complexity

Run by the `complexity-remover` agent, not `implementer`. The method (hunt, then cut at `ponytail` `ultra`) lives in that agent. This block gives scope only.

```
Architecture: phases/phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ.md (BINDING).
Program: phases/phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ_PROGRAM.md (BINDING).
Anexo: phases/phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ_TICKETS.md.
Allowed edits: src/authz/engine/adapter.ts, src/authz/engine/errors.ts, src/authz/engine/adapter.test.ts, src/runtime/steps.ts, src/runtime/tool-call.ts, src/runtime/tool-call.test.ts, src/runtime/decide.ts, src/runtime/post.ts, src/runtime/edge.ts.
Spec slices: all D and PD ids of this unit.
This session is ticket 4 only: the remove-complexity pass. Stop when it is green.
Do not start other tickets. Do not edit the design files.

Resolve the kit config. Read paths.repo_rules first, then factory/policy/memory.md and factory/policy/reading.md. Read the named architecture/program slices and this anexo's Unit close section, Progress Anchor, and your ticket row from disk.
Unit files: src/authz/engine/adapter.ts, src/authz/engine/errors.ts, src/authz/engine/adapter.test.ts, src/runtime/steps.ts, src/runtime/tool-call.ts, src/runtime/tool-call.test.ts, src/runtime/decide.ts, src/runtime/post.ts, src/runtime/edge.ts.
Diff base: the commit immediately before ticket 1's changes (record its hash in the report).

Change only the named landed files. Add no behavior or public API. Do not fix failures owned by earlier tickets: stop and report the owner. Never loosen assertions or delete tests to make close pass.

## Green when

- `commands.typecheck` — exit 0. **Unavailable today** (empty in `factory/config.yaml`): report blocked, not green.
- `commands.lint` — exit 0. **Unavailable today**.
- `commands.format` — exit 0. **Unavailable today**.
- `commands.deps` — exit 0. **Unavailable today**.
- `commands.test_scope` with `{unit}` = `src/authz/engine` — exit 0. **Unavailable today**.
- `commands.test_scope` with `{unit}` = `src/runtime` — exit 0. **Unavailable today**.
- `commands.test_all` — exit 0 (close suite). **Unavailable today**.

## Report

End with these four headings, in this order:
### Done                (changes, files touched, commands and exit codes)
### Not done            (failed checks and exit codes; distinguish earlier failures)
### Choices the design was silent on   (or "none")
### Discovered issues   (each -> owner: ticket #, design, or pre-existing)
```
