# P4.1 Authz seam and call-site inventory — tickets and session prompts

Companion to the BINDING architecture spec [`PHASE4_P4.1_AUTHZ_SEAM.md`](PHASE4_P4.1_AUTHZ_SEAM.md) and BINDING program spec [`PHASE4_P4.1_AUTHZ_SEAM_PROGRAM.md`](PHASE4_P4.1_AUTHZ_SEAM_PROGRAM.md), not a replacement. Architecture owns the law and `D`s. Program design owns landing. This file owns the ticket rows, the sequence, the file fences, the validation contract, and one paste-ready prompt per session. It is not BINDING and needs no review verdict to run (anexo review only on request).

Copy **one SESSION block** into a **new agent session**. Do not paste two tickets into one chat. Do not resume a previous ticket's chat. No code lands with this file. To run the anexo without pasting: a new chat with `run tickets phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM_TICKETS.md` (skill `ticket-orchestrator`).

If the architecture or program spec is ambiguous or you believe it is wrong, **stop and report**. Do not resolve it and do not invent a variant.

**Last ticket is always remove complexity.** Feature work is tickets 1..4. Ticket 5 is run by `complexity-remover` at `ponytail` `ultra`; it adds no behavior and does not fix failures owned by earlier tickets.

## Delivery explained

When done, every authorization call in Navier goes through `NavierAuthz` with the legacy adapter, behaviour unchanged.

## Prerequisite

[P1.2](../phase-1/PHASE1_P1.2_OPERATIONS_PORT.md) tickets.

**Gates today.** Every `commands.*` code gate is empty in `factory/config.yaml`, so every Green-when line below is **unavailable** here: tickets run in the Navier repository once its `package.json` scripts fill the config [U]. An implementer that finds a gate empty reports the ticket blocked, never green (`factory/profile/navier_dbos/tickets.md`).

## Sequence

```
1 -> 2 -> 3 -> 4 -> 5
```

Serial. Each ticket builds on the files and exports the previous one landed.

## Tickets

| # | Ticket | Files it may edit | Green when |
|---|--------|-------------------|------------|
| 1 | Seam types and legacy adapter (D1, D2, L2, PD1) | `src/authz/types.ts`<br>`src/authz/index.ts`<br>`src/authz/legacy/adapter.ts`<br>`src/authz/seam.test.ts` | gates + `commands.test_scope` `src/authz` (unavailable today) |
| 2 | Port runtime sites (D3, PD3) | `src/runtime/tool-call.ts`<br>`src/runtime/decide.ts`<br>`src/runtime/edge.ts`<br>`src/runtime/stop.ts`<br>`src/runtime/post.ts`<br>`src/runtime/blocked.ts`<br>`src/runtime/result.ts` | gates + `commands.test_scope` `src/runtime` (unavailable today) |
| 3 | Port agents, catalog, models, orgconfig; retire agent_principal writes (D3, D5, PD3) | `src/agents/head.ts`<br>`src/agents/store.ts`<br>`src/agents/use.ts`<br>`src/agents/publish.ts`<br>`src/catalog/placement.ts`<br>`src/catalog/serving.ts`<br>`src/catalog/catalog.ts`<br>`src/catalog/list.ts`<br>`src/models/policy.ts`<br>`src/orgconfig/index.ts` | gates + `commands.test_scope` `src/agents` (unavailable today) |
| 4 | Port sdk-publish, api and composition roots (D3, PD3) | `src/sdk-publish/orgconfig-admin.ts`<br>`src/sdk-publish/project-admin.ts`<br>`src/sdk-publish/publish.ts`<br>`src/sdk-publish/admin.ts`<br>`src/api/routes/authz/grant-inputs.ts`<br>`src/api/routes/authz/handler.ts`<br>`src/api/routes/authz/directory.ts`<br>`src/api/routes/chat/handler.ts`<br>`src/api/adapter/check.ts`<br>`src/api/adapter/app.ts`<br>`src/api/conversation-access.ts`<br>`src/api.ts`<br>`src/worker.ts`<br>`src/sdk/runtime.ts` | gates + `commands.test_scope` `src/api` (unavailable today) |
| 5 | Remove complexity from the landed slice. No new behavior. | Only files tickets 1..4 edited | gates + scoped tests, then `commands.test_all` (unavailable today) |

## Validation contract

| V# | Attacks | Kind | Attack | Observable failure | Owner |
|----|---------|------|--------|--------------------|-------|
| V1 | L2 | cmd | adapter given an unknown error | allow | 1 |
| V2 | D2 | cmd | seam tests on legacy adapter | failure | 1 |
| V3 | L1 | cmd | `rg "identity/authz|createAuthz" src --glob "!src/authz/**"` | match | 4 |
| V4 | D5 | cmd | create agent; count agent_principal rows | > 0 | 3 |

**Not attackable:** Engine behaviour ([P4.2](PHASE4_P4.2_NAVIER_MODEL.md), [P4.3](PHASE4_P4.3_WORKFLOW_AUTHZ.md)).

## Progress

Updated by the **implementer** or **complexity-remover** when the ticket finishes (`policy/tickets.md` § Progress settlement).

| # | State | Attempts | Verifier | Handoff |
|---|-------|----------|----------|---------|
| 1 | PENDING | 0 | — | — |
| 2 | PENDING | 0 | — | — |
| 3 | PENDING | 0 | — | — |
| 4 | PENDING | 0 | — | — |
| 5 | PENDING | 0 | — | — |

Handoffs are stored at `.agents/harness/runs/PHASE4_P4.1_AUTHZ_SEAM_TICKETS/ticket-<N>.md`.

### Anchor

- **Intent:** land P4.1 Authz seam and call-site inventory per the BINDING program; 4 feature tickets + complexity close.
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

## SESSION 1 — Ticket 1: Seam types and legacy adapter

```
You are implementing an already-locked design. This is not a redesign.

Architecture: phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM.md (BINDING).
Program: phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM_PROGRAM.md (BINDING).
Anexo: phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM_TICKETS.md.
Allowed edits: src/authz/types.ts, src/authz/index.ts, src/authz/legacy/adapter.ts, src/authz/seam.test.ts.
This session is ticket 1 only. Stop when it is green. Do not start later tickets.
Do not edit the design files. Do not touch folders this ticket does not name.

## Session brief (read first)

`.agents/harness/runs/PHASE4_P4.1_AUTHZ_SEAM_TICKETS/ticket-1-brief.md` under the repo root (resolve to an absolute path). If missing, run from repo root:
`python3 factory/cli.py bundle-session --anexo phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM_TICKETS.md --session 1`
then read the path it prints.

After this anexo is written or amended, the parent runs
`python3 factory/cli.py bundle-session --anexo phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM_TICKETS.md --all`.

## Read before writing code, in this order

Items 1–3 are satisfied by the session brief; do not re-read the whole kit.

1. (brief) Repo rules, layering, code style, profile testing, stack ticket rules, implementation checklist, and skill entrypoint paths.
2. (brief) Memory index when present; follow `policy/reading.md` for spec slices.
3. (brief) Skill routers only (`ticket-testing` included); load `reference.md` files on demand.
4. Read the BINDING architecture ids and program slices this ticket lands: D1, D2, L2, PD1.
5. Read this anexo's Progress Anchor and ticket row 1 from disk. If Attempts is at least 1, read .agents/harness/runs/PHASE4_P4.1_AUTHZ_SEAM_TICKETS/ticket-1.md first. Read nothing else from that directory.
6. Named sources: none beyond the program slices.

## This ticket lands

Seam.

## Rules specific to this ticket

Do not add behavior a later ticket owns. Do not change exported names the program fixes.

## Green when

Run these before reporting green. Do not substitute a broader or thinner suite.

- `commands.typecheck` — exit 0. **Unavailable today** (empty in `factory/config.yaml`): report blocked, not green.
- `commands.lint` — exit 0. **Unavailable today**.
- `commands.format` — exit 0. **Unavailable today**.
- `commands.deps` — exit 0. **Unavailable today**.
- `commands.test_scope` with `{unit}` = `src/authz` — exit 0. **Unavailable today**.
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

## SESSION 2 — Ticket 2: Port runtime sites

```
You are implementing an already-locked design. This is not a redesign.

Architecture: phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM.md (BINDING).
Program: phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM_PROGRAM.md (BINDING).
Anexo: phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM_TICKETS.md.
Allowed edits: src/runtime/tool-call.ts, src/runtime/decide.ts, src/runtime/edge.ts, src/runtime/stop.ts, src/runtime/post.ts, src/runtime/blocked.ts, src/runtime/result.ts.
This session is ticket 2 only. Stop when it is green. Do not start later tickets.
Do not edit the design files. Do not touch folders this ticket does not name.

## Session brief (read first)

`.agents/harness/runs/PHASE4_P4.1_AUTHZ_SEAM_TICKETS/ticket-2-brief.md` under the repo root (resolve to an absolute path). If missing, run from repo root:
`python3 factory/cli.py bundle-session --anexo phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM_TICKETS.md --session 2`
then read the path it prints.

After this anexo is written or amended, the parent runs
`python3 factory/cli.py bundle-session --anexo phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM_TICKETS.md --all`.

## Read before writing code, in this order

Items 1–3 are satisfied by the session brief; do not re-read the whole kit.

1. (brief) Repo rules, layering, code style, profile testing, stack ticket rules, implementation checklist, and skill entrypoint paths.
2. (brief) Memory index when present; follow `policy/reading.md` for spec slices.
3. (brief) Skill routers only (`ticket-testing` included); load `reference.md` files on demand.
4. Read the BINDING architecture ids and program slices this ticket lands: D3, PD3.
5. Read this anexo's Progress Anchor and ticket row 2 from disk. If Attempts is at least 1, read .agents/harness/runs/PHASE4_P4.1_AUTHZ_SEAM_TICKETS/ticket-2.md first. Read nothing else from that directory.
6. Named sources: none beyond the program slices.

## This ticket lands

Runtime.

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

## SESSION 3 — Ticket 3: Port agents, catalog, models, orgconfig; retire agent_principal writes

```
You are implementing an already-locked design. This is not a redesign.

Architecture: phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM.md (BINDING).
Program: phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM_PROGRAM.md (BINDING).
Anexo: phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM_TICKETS.md.
Allowed edits: src/agents/head.ts, src/agents/store.ts, src/agents/use.ts, src/agents/publish.ts, src/catalog/placement.ts, src/catalog/serving.ts, src/catalog/catalog.ts, src/catalog/list.ts, src/models/policy.ts, src/orgconfig/index.ts.
This session is ticket 3 only. Stop when it is green. Do not start later tickets.
Do not edit the design files. Do not touch folders this ticket does not name.

## Session brief (read first)

`.agents/harness/runs/PHASE4_P4.1_AUTHZ_SEAM_TICKETS/ticket-3-brief.md` under the repo root (resolve to an absolute path). If missing, run from repo root:
`python3 factory/cli.py bundle-session --anexo phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM_TICKETS.md --session 3`
then read the path it prints.

After this anexo is written or amended, the parent runs
`python3 factory/cli.py bundle-session --anexo phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM_TICKETS.md --all`.

## Read before writing code, in this order

Items 1–3 are satisfied by the session brief; do not re-read the whole kit.

1. (brief) Repo rules, layering, code style, profile testing, stack ticket rules, implementation checklist, and skill entrypoint paths.
2. (brief) Memory index when present; follow `policy/reading.md` for spec slices.
3. (brief) Skill routers only (`ticket-testing` included); load `reference.md` files on demand.
4. Read the BINDING architecture ids and program slices this ticket lands: D3, D5, PD3.
5. Read this anexo's Progress Anchor and ticket row 3 from disk. If Attempts is at least 1, read .agents/harness/runs/PHASE4_P4.1_AUTHZ_SEAM_TICKETS/ticket-3.md first. Read nothing else from that directory.
6. Named sources: none beyond the program slices.

## This ticket lands

Domain.

## Rules specific to this ticket

Do not add behavior a later ticket owns. Do not change exported names the program fixes.

## Green when

Run these before reporting green. Do not substitute a broader or thinner suite.

- `commands.typecheck` — exit 0. **Unavailable today** (empty in `factory/config.yaml`): report blocked, not green.
- `commands.lint` — exit 0. **Unavailable today**.
- `commands.format` — exit 0. **Unavailable today**.
- `commands.deps` — exit 0. **Unavailable today**.
- `commands.test_scope` with `{unit}` = `src/agents` — exit 0. **Unavailable today**.
- Validation rows owned by ticket 3: V3, V4 (exercised by this ticket's tests).
Do not run the full suite. Do not run tests for units this ticket does not name.

## Report

End with these four headings, in this order:
### Done                (what landed, files touched, commands and exit codes)
### Not done            (includes any Green-when command that failed or was unavailable, with its exit code)
### Choices the design was silent on   (or "none")
### Discovered issues   (each -> owner: ticket #, design, or pre-existing)
```

---

## SESSION 4 — Ticket 4: Port sdk-publish, api and composition roots

```
You are implementing an already-locked design. This is not a redesign.

Architecture: phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM.md (BINDING).
Program: phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM_PROGRAM.md (BINDING).
Anexo: phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM_TICKETS.md.
Allowed edits: src/sdk-publish/orgconfig-admin.ts, src/sdk-publish/project-admin.ts, src/sdk-publish/publish.ts, src/sdk-publish/admin.ts, src/api/routes/authz/grant-inputs.ts, src/api/routes/authz/handler.ts, src/api/routes/authz/directory.ts, src/api/routes/chat/handler.ts, src/api/adapter/check.ts, src/api/adapter/app.ts, src/api/conversation-access.ts, src/api.ts, src/worker.ts, src/sdk/runtime.ts.
This session is ticket 4 only. Stop when it is green. Do not start later tickets.
Do not edit the design files. Do not touch folders this ticket does not name.

## Session brief (read first)

`.agents/harness/runs/PHASE4_P4.1_AUTHZ_SEAM_TICKETS/ticket-4-brief.md` under the repo root (resolve to an absolute path). If missing, run from repo root:
`python3 factory/cli.py bundle-session --anexo phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM_TICKETS.md --session 4`
then read the path it prints.

After this anexo is written or amended, the parent runs
`python3 factory/cli.py bundle-session --anexo phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM_TICKETS.md --all`.

## Read before writing code, in this order

Items 1–3 are satisfied by the session brief; do not re-read the whole kit.

1. (brief) Repo rules, layering, code style, profile testing, stack ticket rules, implementation checklist, and skill entrypoint paths.
2. (brief) Memory index when present; follow `policy/reading.md` for spec slices.
3. (brief) Skill routers only (`ticket-testing` included); load `reference.md` files on demand.
4. Read the BINDING architecture ids and program slices this ticket lands: D3, PD3.
5. Read this anexo's Progress Anchor and ticket row 4 from disk. If Attempts is at least 1, read .agents/harness/runs/PHASE4_P4.1_AUTHZ_SEAM_TICKETS/ticket-4.md first. Read nothing else from that directory.
6. Named sources: none beyond the program slices.

## This ticket lands

API.

## Rules specific to this ticket

Do not add behavior a later ticket owns. Do not change exported names the program fixes.

## Green when

Run these before reporting green. Do not substitute a broader or thinner suite.

- `commands.typecheck` — exit 0. **Unavailable today** (empty in `factory/config.yaml`): report blocked, not green.
- `commands.lint` — exit 0. **Unavailable today**.
- `commands.format` — exit 0. **Unavailable today**.
- `commands.deps` — exit 0. **Unavailable today**.
- `commands.test_scope` with `{unit}` = `src/api` — exit 0. **Unavailable today**.
- Validation rows owned by ticket 4: V3 (exercised by this ticket's tests).
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
Architecture: phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM.md (BINDING).
Program: phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM_PROGRAM.md (BINDING).
Anexo: phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM_TICKETS.md.
Allowed edits: src/authz/types.ts, src/authz/index.ts, src/authz/legacy/adapter.ts, src/authz/seam.test.ts, src/runtime/tool-call.ts, src/runtime/decide.ts, src/runtime/edge.ts, src/runtime/stop.ts, src/runtime/post.ts, src/runtime/blocked.ts, src/runtime/result.ts, src/agents/head.ts, src/agents/store.ts, src/agents/use.ts, src/agents/publish.ts, src/catalog/placement.ts, src/catalog/serving.ts, src/catalog/catalog.ts, src/catalog/list.ts, src/models/policy.ts, src/orgconfig/index.ts, src/sdk-publish/orgconfig-admin.ts, src/sdk-publish/project-admin.ts, src/sdk-publish/publish.ts, src/sdk-publish/admin.ts, src/api/routes/authz/grant-inputs.ts, src/api/routes/authz/handler.ts, src/api/routes/authz/directory.ts, src/api/routes/chat/handler.ts, src/api/adapter/check.ts, src/api/adapter/app.ts, src/api/conversation-access.ts, src/api.ts, src/worker.ts, src/sdk/runtime.ts.
Spec slices: all D and PD ids of this unit.
This session is ticket 5 only: the remove-complexity pass. Stop when it is green.
Do not start other tickets. Do not edit the design files.

Resolve the kit config. Read paths.repo_rules first, then factory/policy/memory.md and factory/policy/reading.md. Read the named architecture/program slices and this anexo's Unit close section, Progress Anchor, and your ticket row from disk.
Unit files: src/authz/types.ts, src/authz/index.ts, src/authz/legacy/adapter.ts, src/authz/seam.test.ts, src/runtime/tool-call.ts, src/runtime/decide.ts, src/runtime/edge.ts, src/runtime/stop.ts, src/runtime/post.ts, src/runtime/blocked.ts, src/runtime/result.ts, src/agents/head.ts, src/agents/store.ts, src/agents/use.ts, src/agents/publish.ts, src/catalog/placement.ts, src/catalog/serving.ts, src/catalog/catalog.ts, src/catalog/list.ts, src/models/policy.ts, src/orgconfig/index.ts, src/sdk-publish/orgconfig-admin.ts, src/sdk-publish/project-admin.ts, src/sdk-publish/publish.ts, src/sdk-publish/admin.ts, src/api/routes/authz/grant-inputs.ts, src/api/routes/authz/handler.ts, src/api/routes/authz/directory.ts, src/api/routes/chat/handler.ts, src/api/adapter/check.ts, src/api/adapter/app.ts, src/api/conversation-access.ts, src/api.ts, src/worker.ts, src/sdk/runtime.ts.
Diff base: the commit immediately before ticket 1's changes (record its hash in the report).

Change only the named landed files. Add no behavior or public API. Do not fix failures owned by earlier tickets: stop and report the owner. Never loosen assertions or delete tests to make close pass.

## Green when

- `commands.typecheck` — exit 0. **Unavailable today** (empty in `factory/config.yaml`): report blocked, not green.
- `commands.lint` — exit 0. **Unavailable today**.
- `commands.format` — exit 0. **Unavailable today**.
- `commands.deps` — exit 0. **Unavailable today**.
- `commands.test_scope` with `{unit}` = `src/authz` — exit 0. **Unavailable today**.
- `commands.test_scope` with `{unit}` = `src/runtime` — exit 0. **Unavailable today**.
- `commands.test_scope` with `{unit}` = `src/agents` — exit 0. **Unavailable today**.
- `commands.test_scope` with `{unit}` = `src/api` — exit 0. **Unavailable today**.
- `commands.test_all` — exit 0 (close suite). **Unavailable today**.

## Report

End with these four headings, in this order:
### Done                (changes, files touched, commands and exit codes)
### Not done            (failed checks and exit codes; distinguish earlier failures)
### Choices the design was silent on   (or "none")
### Discovered issues   (each -> owner: ticket #, design, or pre-existing)
```
