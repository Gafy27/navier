# P3.2 Pending messages and promotion without a lost start — tickets and session prompts

Companion to the BINDING architecture spec [`PHASE3_P3.2_PENDING_PROMOTION.md`](PHASE3_P3.2_PENDING_PROMOTION.md) and BINDING program spec [`PHASE3_P3.2_PENDING_PROMOTION_PROGRAM.md`](PHASE3_P3.2_PENDING_PROMOTION_PROGRAM.md), not a replacement. Architecture owns the law and `D`s. Program design owns landing. This file owns the ticket rows, the sequence, the file fences, the validation contract, and one paste-ready prompt per session. It is not BINDING and needs no review verdict to run (anexo review only on request).

Copy **one SESSION block** into a **new agent session**. Do not paste two tickets into one chat. Do not resume a previous ticket's chat. No code lands with this file. To run the anexo without pasting: a new chat with `run tickets phases/phase-3/PHASE3_P3.2_PENDING_PROMOTION_TICKETS.md` (skill `ticket-orchestrator`).

If the architecture or program spec is ambiguous or you believe it is wrong, **stop and report**. Do not resolve it and do not invent a variant.

**Last ticket is always remove complexity.** Feature work is tickets 1..2. Ticket 3 is run by `complexity-remover` at `ponytail` `ultra`; it adds no behavior and does not fix failures owned by earlier tickets.

## Delivery explained

When done, S9 passes on DBOS with the promoted turn enqueued in the close transaction.

## Prerequisite

[P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) ticket 2.

**Gates today.** Every `commands.*` code gate is empty in `factory/config.yaml`, so every Green-when line below is **unavailable** here: tickets run in the Navier repository once its `package.json` scripts fill the config [U]. An implementer that finds a gate empty reports the ticket blocked, never green (`factory/profile/navier_dbos/tickets.md`).

## Sequence

```
1 -> 2 -> 3
```

Serial. Each ticket builds on the files and exports the previous one landed.

## Tickets

| # | Ticket | Files it may edit | Green when |
|---|--------|-------------------|------------|
| 1 | Promotion hook in closeTurn (D1, L1, PD1) | `src/runtime/close.ts`<br>`src/runner/dbos/steps.ts`<br>`src/runtime/close.test.ts` | gates + `commands.test_scope` `src/runtime` (unavailable today) |
| 2 | Pending arm without graceful signal on DBOS (D2) | `src/runtime/start.ts`<br>`src/runtime/start.test.ts` | gates + `commands.test_scope` `src/runtime` (unavailable today) |
| 3 | Remove complexity from the landed slice. No new behavior. | Only files tickets 1..2 edited | gates + scoped tests, then `commands.test_all` (unavailable today) |

## Validation contract

| V# | Attacks | Kind | Attack | Observable failure | Owner |
|----|---------|------|--------|--------------------|-------|
| V1 | L1 | cmd | roll back the finish tx after mint | promoted workflow exists | 1 |
| V2 | D1 | cmd | re-run finish step | second promoted message | 1 |
| V3 | D2 | cmd | post while running on DBOS | turn not gracefully stopped at boundary | 2 |

**Not attackable:** Temporal path (frozen).

## Progress

Updated by the **implementer** or **complexity-remover** when the ticket finishes (`policy/tickets.md` § Progress settlement).

| # | State | Attempts | Verifier | Handoff |
|---|-------|----------|----------|---------|
| 1 | PENDING | 0 | — | — |
| 2 | PENDING | 0 | — | — |
| 3 | PENDING | 0 | — | — |

Handoffs are stored at `.agents/harness/runs/PHASE3_P3.2_PENDING_PROMOTION_TICKETS/ticket-<N>.md`.

### Anchor

- **Intent:** land P3.2 Pending messages and promotion without a lost start per the BINDING program; 2 feature tickets + complexity close.
- **Files touched so far:** none (no ticket has run).
- **Decisions:** none.
- **Open issues → owner / Next:** code gates unavailable → Navier repo config; next ticket 1.

## Fences every ticket runs

TypeScript stack rules (`factory/stack/typescript/tickets.md`): `commands.typecheck`, `lint`, `format`, `deps` (skip any the config leaves empty **only after the Navier repo fills them**; today all are empty and the ticket is blocked), then `commands.test_scope` for each workspace folder in Files it may edit. Do **not** run `commands.test_all` except on ticket 3. Do **not** run another unit's tests. An `rg` ban passes when it reports nothing (exit 1 = no match; exit 2 = tool error, which fails).

## Unit close (ticket 3 only)

After the remove-complexity diff run the gates and scoped tests, then `commands.test_all`. `commands.setup_integration` only when a V-row saved for close needs it (unavailable until the P1.5 harness lands). If a required close command is unavailable, report the blocker rather than skipping it.

## What no ticket may do

- Edit `src/runner/temporal/` (frozen adapter, P1.3) or `src/llm/` (owner decision 2) unless this ticket's fence names it.
- Put text, request context, tool arguments, outputs or credentials into a workflow input, step output, DBOS message or event (P2.1 L2).
- Edit any `PHASE*.md` design file, a review file, or `factory/`.

---

## SESSION 1 — Ticket 1: Promotion hook in closeTurn

```
You are implementing an already-locked design. This is not a redesign.

Architecture: phases/phase-3/PHASE3_P3.2_PENDING_PROMOTION.md (BINDING).
Program: phases/phase-3/PHASE3_P3.2_PENDING_PROMOTION_PROGRAM.md (BINDING).
Anexo: phases/phase-3/PHASE3_P3.2_PENDING_PROMOTION_TICKETS.md.
Allowed edits: src/runtime/close.ts, src/runner/dbos/steps.ts, src/runtime/close.test.ts.
This session is ticket 1 only. Stop when it is green. Do not start later tickets.
Do not edit the design files. Do not touch folders this ticket does not name.

## Session brief (read first)

`.agents/harness/runs/PHASE3_P3.2_PENDING_PROMOTION_TICKETS/ticket-1-brief.md` under the repo root (resolve to an absolute path). If missing, run from repo root:
`python3 factory/cli.py bundle-session --anexo phases/phase-3/PHASE3_P3.2_PENDING_PROMOTION_TICKETS.md --session 1`
then read the path it prints.

After this anexo is written or amended, the parent runs
`python3 factory/cli.py bundle-session --anexo phases/phase-3/PHASE3_P3.2_PENDING_PROMOTION_TICKETS.md --all`.

## Read before writing code, in this order

Items 1–3 are satisfied by the session brief; do not re-read the whole kit.

1. (brief) Repo rules, layering, code style, profile testing, stack ticket rules, implementation checklist, and skill entrypoint paths.
2. (brief) Memory index when present; follow `policy/reading.md` for spec slices.
3. (brief) Skill routers only (`ticket-testing` included); load `reference.md` files on demand.
4. Read the BINDING architecture ids and program slices this ticket lands: D1, L1, PD1.
5. Read this anexo's Progress Anchor and ticket row 1 from disk. If Attempts is at least 1, read .agents/harness/runs/PHASE3_P3.2_PENDING_PROMOTION_TICKETS/ticket-1.md first. Read nothing else from that directory.
6. Named sources: none beyond the program slices.

## This ticket lands

Hook.

## Rules specific to this ticket

Do not add behavior a later ticket owns. Do not change exported names the program fixes.

## Green when

Run these before reporting green. Do not substitute a broader or thinner suite.

- `commands.typecheck` — exit 0. **Unavailable today** (empty in `factory/config.yaml`): report blocked, not green.
- `commands.lint` — exit 0. **Unavailable today**.
- `commands.format` — exit 0. **Unavailable today**.
- `commands.deps` — exit 0. **Unavailable today**.
- `commands.test_scope` with `{unit}` = `src/runtime` — exit 0. **Unavailable today**.
- Validation rows owned by ticket 1: V1, V2 (exercised by this ticket's tests).
Do not run the full suite. Do not run tests for units this ticket does not name.

## Report

End with these four headings, in this order:
### Done                (what landed, files touched, commands and exit codes)
### Not done            (includes any Green-when command that failed or was unavailable, with its exit code)
### Choices the design was silent on   (or "none")
### Discovered issues   (each -> owner: ticket #, design, or pre-existing)
```

---

## SESSION 2 — Ticket 2: Pending arm without graceful signal on DBOS

```
You are implementing an already-locked design. This is not a redesign.

Architecture: phases/phase-3/PHASE3_P3.2_PENDING_PROMOTION.md (BINDING).
Program: phases/phase-3/PHASE3_P3.2_PENDING_PROMOTION_PROGRAM.md (BINDING).
Anexo: phases/phase-3/PHASE3_P3.2_PENDING_PROMOTION_TICKETS.md.
Allowed edits: src/runtime/start.ts, src/runtime/start.test.ts.
This session is ticket 2 only. Stop when it is green. Do not start later tickets.
Do not edit the design files. Do not touch folders this ticket does not name.

## Session brief (read first)

`.agents/harness/runs/PHASE3_P3.2_PENDING_PROMOTION_TICKETS/ticket-2-brief.md` under the repo root (resolve to an absolute path). If missing, run from repo root:
`python3 factory/cli.py bundle-session --anexo phases/phase-3/PHASE3_P3.2_PENDING_PROMOTION_TICKETS.md --session 2`
then read the path it prints.

After this anexo is written or amended, the parent runs
`python3 factory/cli.py bundle-session --anexo phases/phase-3/PHASE3_P3.2_PENDING_PROMOTION_TICKETS.md --all`.

## Read before writing code, in this order

Items 1–3 are satisfied by the session brief; do not re-read the whole kit.

1. (brief) Repo rules, layering, code style, profile testing, stack ticket rules, implementation checklist, and skill entrypoint paths.
2. (brief) Memory index when present; follow `policy/reading.md` for spec slices.
3. (brief) Skill routers only (`ticket-testing` included); load `reference.md` files on demand.
4. Read the BINDING architecture ids and program slices this ticket lands: D2.
5. Read this anexo's Progress Anchor and ticket row 2 from disk. If Attempts is at least 1, read .agents/harness/runs/PHASE3_P3.2_PENDING_PROMOTION_TICKETS/ticket-2.md first. Read nothing else from that directory.
6. Named sources: none beyond the program slices.

## This ticket lands

Graceful.

## Rules specific to this ticket

Do not add behavior a later ticket owns. Do not change exported names the program fixes.

## Green when

Run these before reporting green. Do not substitute a broader or thinner suite.

- `commands.typecheck` — exit 0. **Unavailable today** (empty in `factory/config.yaml`): report blocked, not green.
- `commands.lint` — exit 0. **Unavailable today**.
- `commands.format` — exit 0. **Unavailable today**.
- `commands.deps` — exit 0. **Unavailable today**.
- `commands.test_scope` with `{unit}` = `src/runtime` — exit 0. **Unavailable today**.
- Validation rows owned by ticket 2: V3 (exercised by this ticket's tests).
Do not run the full suite. Do not run tests for units this ticket does not name.

## Report

End with these four headings, in this order:
### Done                (what landed, files touched, commands and exit codes)
### Not done            (includes any Green-when command that failed or was unavailable, with its exit code)
### Choices the design was silent on   (or "none")
### Discovered issues   (each -> owner: ticket #, design, or pre-existing)
```

---

## SESSION 3 — Ticket 3: remove complexity

Run by the `complexity-remover` agent, not `implementer`. The method (hunt, then cut at `ponytail` `ultra`) lives in that agent. This block gives scope only.

```
Architecture: phases/phase-3/PHASE3_P3.2_PENDING_PROMOTION.md (BINDING).
Program: phases/phase-3/PHASE3_P3.2_PENDING_PROMOTION_PROGRAM.md (BINDING).
Anexo: phases/phase-3/PHASE3_P3.2_PENDING_PROMOTION_TICKETS.md.
Allowed edits: src/runtime/close.ts, src/runner/dbos/steps.ts, src/runtime/close.test.ts, src/runtime/start.ts, src/runtime/start.test.ts.
Spec slices: all D and PD ids of this unit.
This session is ticket 3 only: the remove-complexity pass. Stop when it is green.
Do not start other tickets. Do not edit the design files.

Resolve the kit config. Read paths.repo_rules first, then factory/policy/memory.md and factory/policy/reading.md. Read the named architecture/program slices and this anexo's Unit close section, Progress Anchor, and your ticket row from disk.
Unit files: src/runtime/close.ts, src/runner/dbos/steps.ts, src/runtime/close.test.ts, src/runtime/start.ts, src/runtime/start.test.ts.
Diff base: the commit immediately before ticket 1's changes (record its hash in the report).

Change only the named landed files. Add no behavior or public API. Do not fix failures owned by earlier tickets: stop and report the owner. Never loosen assertions or delete tests to make close pass.

## Green when

- `commands.typecheck` — exit 0. **Unavailable today** (empty in `factory/config.yaml`): report blocked, not green.
- `commands.lint` — exit 0. **Unavailable today**.
- `commands.format` — exit 0. **Unavailable today**.
- `commands.deps` — exit 0. **Unavailable today**.
- `commands.test_scope` with `{unit}` = `src/runtime` — exit 0. **Unavailable today**.
- `commands.test_all` — exit 0 (close suite). **Unavailable today**.

## Report

End with these four headings, in this order:
### Done                (changes, files touched, commands and exit codes)
### Not done            (failed checks and exit codes; distinguish earlier failures)
### Choices the design was silent on   (or "none")
### Discovered issues   (each -> owner: ticket #, design, or pre-existing)
```
