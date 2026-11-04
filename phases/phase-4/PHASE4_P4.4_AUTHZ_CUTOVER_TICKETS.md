# P4.4 Migration and cutover from the old authz service — tickets and session prompts

Companion to the BINDING architecture spec [`PHASE4_P4.4_AUTHZ_CUTOVER.md`](PHASE4_P4.4_AUTHZ_CUTOVER.md) and BINDING program spec [`PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM.md`](PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM.md), not a replacement. Architecture owns the law and `D`s. Program design owns landing. This file owns the ticket rows, the sequence, the file fences, the validation contract, and one paste-ready prompt per session. It is not BINDING and needs no review verdict to run (anexo review only on request).

Copy **one SESSION block** into a **new agent session**. Do not paste two tickets into one chat. Do not resume a previous ticket's chat. No code lands with this file. To run the anexo without pasting: a new chat with `run tickets phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS.md` (skill `ticket-orchestrator`).

If the architecture or program spec is ambiguous or you believe it is wrong, **stop and report**. Do not resolve it and do not invent a variant.

**Last ticket is always remove complexity.** Feature work is tickets 1..4. Ticket 5 is run by `complexity-remover` at `ponytail` `ultra`; it adds no behavior and does not fix failures owned by earlier tickets.

## Delivery explained

When done, any org can run in shadow, flip to the engine, and roll back by flag.

## Prerequisite

[P4.3](PHASE4_P4.3_WORKFLOW_AUTHZ.md) tickets.

**Gates today.** Every `commands.*` code gate is empty in `factory/config.yaml`, so every Green-when line below is **unavailable** here: tickets run in the Navier repository once its `package.json` scripts fill the config [U]. An implementer that finds a gate empty reports the ticket blocked, never green (`factory/profile/navier_dbos/tickets.md`).

**Open review findings.** The siblings are BINDING with unresolved R3-F1 (program), R3-F2 (program). Orgs with markings may not flip until [P4.2](PHASE4_P4.2_NAVIER_MODEL.md) B1 is resolved; the flip ticket checks this.

## Sequence

```
1 -> 2 -> 3 -> 4 -> 5
```

Serial. Each ticket builds on the files and exports the previous one landed.

## Tickets

| # | Ticket | Files it may edit | Green when |
|---|--------|-------------------|------------|
| 1 | Export, map, import job (D1, PD3) | `scripts/authz/export.ts`<br>`scripts/authz/import.ts`<br>`scripts/authz/import.test.ts` | gates + `commands.test_scope` `scripts/authz` (unavailable today) |
| 2 | Shadow adapter and diff sink (D2, D3, PD1) | `src/authz/shadow.ts`<br>`src/authz/shadow.test.ts` | gates + `commands.test_scope` `src/authz` (unavailable today) |
| 3 | Outbox and reconcile (D4, PD2) | `src/authz/outbox.ts`<br>`src/authz/migrations/authz_outbox.ts`<br>`scripts/authz/reconcile.ts` | gates + `commands.test_scope` `src/authz` (unavailable today) |
| 4 | Per-org mode flags and flip guard (D5, D6) | `src/authz/index.ts`<br>`src/authz/mode.test.ts` | gates + `commands.test_scope` `src/authz` (unavailable today) |
| 5 | Remove complexity from the landed slice. No new behavior. | Only files tickets 1..4 edited | gates + scoped tests, then `commands.test_all` (unavailable today) |

## Validation contract

| V# | Attacks | Kind | Attack | Observable failure | Owner |
|----|---------|------|--------|--------------------|-------|
| V1 | D1 | cmd | import twice | duplicate tuples | 1 |
| V2 | D3 | cmd | diff record fields | subject or text present | 2 |
| V3 | D4 | cmd | engine write fails after legacy | not reconciled | 3 |
| V4 | D5 | cmd | flip org with markings while B1 open | flip allowed | 4 |

**Not attackable:** Runner flags ([P5.2](../phase-5/PHASE5_P5.2_ROLLOUT_FLAGS.md)).

## Progress

Updated by the **implementer** or **complexity-remover** when the ticket finishes (`policy/tickets.md` § Progress settlement).

| # | State | Attempts | Verifier | Handoff |
|---|-------|----------|----------|---------|
| 1 | PENDING | 0 | — | — |
| 2 | PENDING | 0 | — | — |
| 3 | PENDING | 0 | — | — |
| 4 | PENDING | 0 | — | — |
| 5 | PENDING | 0 | — | — |

Handoffs are stored at `.agents/harness/runs/PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS/ticket-<N>.md`.

### Anchor

- **Intent:** land P4.4 Migration and cutover from the old authz service per the BINDING program; 4 feature tickets + complexity close.
- **Files touched so far:** none (no ticket has run).
- **Decisions:** none.
- **Open issues → owner / Next:** code gates unavailable → Navier repo config; next ticket 1.

## Fences every ticket runs

TypeScript stack rules (`factory/stack/typescript/tickets.md`): `commands.typecheck`, `lint`, `format`, `deps` (skip any the config leaves empty **only after the Navier repo fills them**; today all are empty and the ticket is blocked), then `commands.test_scope` for each workspace folder in Files it may edit. Do **not** run `commands.test_all` except on ticket 5. Do **not** run another unit's tests. An `rg` ban passes when it reports nothing (exit 1 = no match; exit 2 = tool error, which fails).

## Unit close (ticket 5 only)

After the remove-complexity diff run the gates and scoped tests, then `commands.test_all`. `commands.setup_integration` only when a V-row saved for close needs it (unavailable until the P1.5 harness lands). If a required close command is unavailable, report the blocker rather than skipping it.

## What no ticket may do

- Edit `src/runner/temporal/` (frozen adapter, P1.3) or `src/llm/` (owner decision 2) unless this ticket's fence names it.
- Put text, request context, tool arguments, outputs or credentials into a workflow input, step output, DBOS message or event (P2.1 L2).
- Edit any `PHASE*.md` design file, a review file, or `factory/`.

---

## SESSION 1 — Ticket 1: Export, map, import job

```
You are implementing an already-locked design. This is not a redesign.

Architecture: phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER.md (BINDING).
Program: phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM.md (BINDING).
Anexo: phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS.md.
Allowed edits: scripts/authz/export.ts, scripts/authz/import.ts, scripts/authz/import.test.ts.
This session is ticket 1 only. Stop when it is green. Do not start later tickets.
Do not edit the design files. Do not touch folders this ticket does not name.

## Session brief (read first)

`.agents/harness/runs/PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS/ticket-1-brief.md` under the repo root (resolve to an absolute path). If missing, run from repo root:
`python3 factory/cli.py bundle-session --anexo phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS.md --session 1`
then read the path it prints.

After this anexo is written or amended, the parent runs
`python3 factory/cli.py bundle-session --anexo phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS.md --all`.

## Read before writing code, in this order

Items 1–3 are satisfied by the session brief; do not re-read the whole kit.

1. (brief) Repo rules, layering, code style, profile testing, stack ticket rules, implementation checklist, and skill entrypoint paths.
2. (brief) Memory index when present; follow `policy/reading.md` for spec slices.
3. (brief) Skill routers only (`ticket-testing` included); load `reference.md` files on demand.
4. Read the BINDING architecture ids and program slices this ticket lands: D1, PD3.
5. Read this anexo's Progress Anchor and ticket row 1 from disk. If Attempts is at least 1, read .agents/harness/runs/PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS/ticket-1.md first. Read nothing else from that directory.
6. Named sources: none beyond the program slices.

## This ticket lands

Data.

## Rules specific to this ticket

Do not add behavior a later ticket owns. Do not change exported names the program fixes.

## Green when

Run these before reporting green. Do not substitute a broader or thinner suite.

- `commands.typecheck` — exit 0. **Unavailable today** (empty in `factory/config.yaml`): report blocked, not green.
- `commands.lint` — exit 0. **Unavailable today**.
- `commands.format` — exit 0. **Unavailable today**.
- `commands.deps` — exit 0. **Unavailable today**.
- `commands.test_scope` with `{unit}` = `scripts/authz` — exit 0. **Unavailable today**.
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

## SESSION 2 — Ticket 2: Shadow adapter and diff sink

```
You are implementing an already-locked design. This is not a redesign.

Architecture: phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER.md (BINDING).
Program: phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM.md (BINDING).
Anexo: phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS.md.
Allowed edits: src/authz/shadow.ts, src/authz/shadow.test.ts.
This session is ticket 2 only. Stop when it is green. Do not start later tickets.
Do not edit the design files. Do not touch folders this ticket does not name.

## Session brief (read first)

`.agents/harness/runs/PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS/ticket-2-brief.md` under the repo root (resolve to an absolute path). If missing, run from repo root:
`python3 factory/cli.py bundle-session --anexo phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS.md --session 2`
then read the path it prints.

After this anexo is written or amended, the parent runs
`python3 factory/cli.py bundle-session --anexo phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS.md --all`.

## Read before writing code, in this order

Items 1–3 are satisfied by the session brief; do not re-read the whole kit.

1. (brief) Repo rules, layering, code style, profile testing, stack ticket rules, implementation checklist, and skill entrypoint paths.
2. (brief) Memory index when present; follow `policy/reading.md` for spec slices.
3. (brief) Skill routers only (`ticket-testing` included); load `reference.md` files on demand.
4. Read the BINDING architecture ids and program slices this ticket lands: D2, D3, PD1.
5. Read this anexo's Progress Anchor and ticket row 2 from disk. If Attempts is at least 1, read .agents/harness/runs/PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS/ticket-2.md first. Read nothing else from that directory.
6. Named sources: none beyond the program slices.

## This ticket lands

Shadow.

## Rules specific to this ticket

Do not add behavior a later ticket owns. Do not change exported names the program fixes.

## Green when

Run these before reporting green. Do not substitute a broader or thinner suite.

- `commands.typecheck` — exit 0. **Unavailable today** (empty in `factory/config.yaml`): report blocked, not green.
- `commands.lint` — exit 0. **Unavailable today**.
- `commands.format` — exit 0. **Unavailable today**.
- `commands.deps` — exit 0. **Unavailable today**.
- `commands.test_scope` with `{unit}` = `src/authz` — exit 0. **Unavailable today**.
- Validation rows owned by ticket 2: V2 (exercised by this ticket's tests).
Do not run the full suite. Do not run tests for units this ticket does not name.

## Report

End with these four headings, in this order:
### Done                (what landed, files touched, commands and exit codes)
### Not done            (includes any Green-when command that failed or was unavailable, with its exit code)
### Choices the design was silent on   (or "none")
### Discovered issues   (each -> owner: ticket #, design, or pre-existing)
```

---

## SESSION 3 — Ticket 3: Outbox and reconcile

```
You are implementing an already-locked design. This is not a redesign.

Architecture: phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER.md (BINDING).
Program: phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM.md (BINDING).
Anexo: phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS.md.
Allowed edits: src/authz/outbox.ts, src/authz/migrations/authz_outbox.ts, scripts/authz/reconcile.ts.
This session is ticket 3 only. Stop when it is green. Do not start later tickets.
Do not edit the design files. Do not touch folders this ticket does not name.

## Session brief (read first)

`.agents/harness/runs/PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS/ticket-3-brief.md` under the repo root (resolve to an absolute path). If missing, run from repo root:
`python3 factory/cli.py bundle-session --anexo phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS.md --session 3`
then read the path it prints.

After this anexo is written or amended, the parent runs
`python3 factory/cli.py bundle-session --anexo phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS.md --all`.

## Read before writing code, in this order

Items 1–3 are satisfied by the session brief; do not re-read the whole kit.

1. (brief) Repo rules, layering, code style, profile testing, stack ticket rules, implementation checklist, and skill entrypoint paths.
2. (brief) Memory index when present; follow `policy/reading.md` for spec slices.
3. (brief) Skill routers only (`ticket-testing` included); load `reference.md` files on demand.
4. Read the BINDING architecture ids and program slices this ticket lands: D4, PD2.
5. Read this anexo's Progress Anchor and ticket row 3 from disk. If Attempts is at least 1, read .agents/harness/runs/PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS/ticket-3.md first. Read nothing else from that directory.
6. Named sources: none beyond the program slices.

## This ticket lands

Outbox.

## Rules specific to this ticket

Do not add behavior a later ticket owns. Do not change exported names the program fixes.

## Green when

Run these before reporting green. Do not substitute a broader or thinner suite.

- `commands.typecheck` — exit 0. **Unavailable today** (empty in `factory/config.yaml`): report blocked, not green.
- `commands.lint` — exit 0. **Unavailable today**.
- `commands.format` — exit 0. **Unavailable today**.
- `commands.deps` — exit 0. **Unavailable today**.
- `commands.test_scope` with `{unit}` = `src/authz` — exit 0. **Unavailable today**.
- Validation rows owned by ticket 3: V3 (exercised by this ticket's tests).
Do not run the full suite. Do not run tests for units this ticket does not name.

## Report

End with these four headings, in this order:
### Done                (what landed, files touched, commands and exit codes)
### Not done            (includes any Green-when command that failed or was unavailable, with its exit code)
### Choices the design was silent on   (or "none")
### Discovered issues   (each -> owner: ticket #, design, or pre-existing)
```

---

## SESSION 4 — Ticket 4: Per-org mode flags and flip guard

```
You are implementing an already-locked design. This is not a redesign.

Architecture: phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER.md (BINDING).
Program: phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM.md (BINDING).
Anexo: phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS.md.
Allowed edits: src/authz/index.ts, src/authz/mode.test.ts.
This session is ticket 4 only. Stop when it is green. Do not start later tickets.
Do not edit the design files. Do not touch folders this ticket does not name.

## Session brief (read first)

`.agents/harness/runs/PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS/ticket-4-brief.md` under the repo root (resolve to an absolute path). If missing, run from repo root:
`python3 factory/cli.py bundle-session --anexo phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS.md --session 4`
then read the path it prints.

After this anexo is written or amended, the parent runs
`python3 factory/cli.py bundle-session --anexo phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS.md --all`.

## Read before writing code, in this order

Items 1–3 are satisfied by the session brief; do not re-read the whole kit.

1. (brief) Repo rules, layering, code style, profile testing, stack ticket rules, implementation checklist, and skill entrypoint paths.
2. (brief) Memory index when present; follow `policy/reading.md` for spec slices.
3. (brief) Skill routers only (`ticket-testing` included); load `reference.md` files on demand.
4. Read the BINDING architecture ids and program slices this ticket lands: D5, D6.
5. Read this anexo's Progress Anchor and ticket row 4 from disk. If Attempts is at least 1, read .agents/harness/runs/PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS/ticket-4.md first. Read nothing else from that directory.
6. Named sources: none beyond the program slices.

## This ticket lands

Flags.

## Rules specific to this ticket

Do not add behavior a later ticket owns. Do not change exported names the program fixes.

## Green when

Run these before reporting green. Do not substitute a broader or thinner suite.

- `commands.typecheck` — exit 0. **Unavailable today** (empty in `factory/config.yaml`): report blocked, not green.
- `commands.lint` — exit 0. **Unavailable today**.
- `commands.format` — exit 0. **Unavailable today**.
- `commands.deps` — exit 0. **Unavailable today**.
- `commands.test_scope` with `{unit}` = `src/authz` — exit 0. **Unavailable today**.
- Validation rows owned by ticket 4: V4 (exercised by this ticket's tests).
Do not run the full suite. Do not run tests for units this ticket does not name.

## Report

End with these four headings, in this order:
### Done                (what landed, files touched, commands and exit codes)
### Not done            (includes any Green-when command that failed or was unavailable, with its exit code)
### Choices the design was silent on   (or "none")
### Discovered issues   (each -> owner: ticket #, design, or pre-existing)
```

---

## SESSION 5 — Ticket 5: remove complexity

Run by the `complexity-remover` agent, not `implementer`. The method (hunt, then cut at `ponytail` `ultra`) lives in that agent. This block gives scope only.

```
Architecture: phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER.md (BINDING).
Program: phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM.md (BINDING).
Anexo: phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS.md.
Allowed edits: scripts/authz/export.ts, scripts/authz/import.ts, scripts/authz/import.test.ts, src/authz/shadow.ts, src/authz/shadow.test.ts, src/authz/outbox.ts, src/authz/migrations/authz_outbox.ts, scripts/authz/reconcile.ts, src/authz/index.ts, src/authz/mode.test.ts.
Spec slices: all D and PD ids of this unit.
This session is ticket 5 only: the remove-complexity pass. Stop when it is green.
Do not start other tickets. Do not edit the design files.

Resolve the kit config. Read paths.repo_rules first, then factory/policy/memory.md and factory/policy/reading.md. Read the named architecture/program slices and this anexo's Unit close section, Progress Anchor, and your ticket row from disk.
Unit files: scripts/authz/export.ts, scripts/authz/import.ts, scripts/authz/import.test.ts, src/authz/shadow.ts, src/authz/shadow.test.ts, src/authz/outbox.ts, src/authz/migrations/authz_outbox.ts, scripts/authz/reconcile.ts, src/authz/index.ts, src/authz/mode.test.ts.
Diff base: the commit immediately before ticket 1's changes (record its hash in the report).

Change only the named landed files. Add no behavior or public API. Do not fix failures owned by earlier tickets: stop and report the owner. Never loosen assertions or delete tests to make close pass.

## Green when

- `commands.typecheck` — exit 0. **Unavailable today** (empty in `factory/config.yaml`): report blocked, not green.
- `commands.lint` — exit 0. **Unavailable today**.
- `commands.format` — exit 0. **Unavailable today**.
- `commands.deps` — exit 0. **Unavailable today**.
- `commands.test_scope` with `{unit}` = `scripts/authz` — exit 0. **Unavailable today**.
- `commands.test_scope` with `{unit}` = `src/authz` — exit 0. **Unavailable today**.
- `commands.test_all` — exit 0 (close suite). **Unavailable today**.

## Report

End with these four headings, in this order:
### Done                (changes, files touched, commands and exit codes)
### Not done            (failed checks and exit codes; distinguish earlier failures)
### Choices the design was silent on   (or "none")
### Discovered issues   (each -> owner: ticket #, design, or pre-existing)
```
