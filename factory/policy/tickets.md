# Tickets

Companion policy for the kit's `templates/TICKETS.md` and every `*_TICKETS.md`
anexo under `paths.designs`. The architecture spec owns the law. The program
spec owns landing (files, signatures, call graph, seams, call sites). The
anexo owns ticket rows, sequence, fences, the validation contract, and one
SESSION prompt per ticket.

Write the anexo only after the program sibling is BINDING
([`design.md`](design.md)). Units already BINDING with no program sibling are
grandfathered.

**Green-when commands are per language.** Read
`stack/<project.language>/tickets.md` (Rust: [`../stack/rust/tickets.md`](../stack/rust/tickets.md),
TypeScript: [`../stack/typescript/tickets.md`](../stack/typescript/tickets.md),
C / Basilisk: [`../stack/c/tickets.md`](../stack/c/tickets.md)).
Do not run the other stack's gates. Product extras (which bins, smoke scripts)
live in [`../profile/`](../profile/).

Do not run an anexo while the program sibling is `draft` (or missing on a
**new** unit). Orchestrator: if `vocabulary.program_file` exists, it must be
BINDING; if it is absent, architecture BINDING is enough (grandfather).

An independent review of the ticket plan is optional and runs only on request.
No anexo review verdict is required before execution. BINDING prerequisites,
file fences, validation contracts, and stop-and-report rules still apply.
Post-implementation reviews remain governed by **Review level** below.

## Token discipline (must read)

**Every agent** that implements, reviews, orchestrates, or validates a
`*_TICKETS.md` SESSION must read this section before acting. Parents do not
re-run an implementer's Green-when to "confirm" ticket N−1.

| Do | Do not |
|----|--------|
| Run **Green when after your diff** (this ticket only) | Re-run typecheck/lint/format or unrelated `test UNIT=` **before** editing on serial ticket **N > 1** |
| Read the session brief, fence, and **named source paths** | Shell-`cat`/`ls` the kit tree to "discover" bootstrap |
| Assume tickets 1..N−1 are green; `PENDING` + landed files = stale Progress (proceed) | Block on `PENDING` alone or narrate pre-edit baseline checks |
| Record pre-edit baselines only when the **anexo prerequisite** or SESSION explicitly requires them (usually **ticket 1** only) | Treat "validation contract baseline" as "run all gates first" |

**Retries:** when `Attempts ≥ 1`, read the handoff file; run pre-edit checks only if
the handoff says the tree was red or the SESSION orders them.

**Bugs/refactors (non-ticket):** reproduction or equivalence baseline still applies
(`policy/rules.md` § Goal-driven execution); this table is for **serial ticket**
work.

## Isolation

Copy **one** SESSION block into a **new** agent session. Each implementer
SESSION fence includes `## Session brief (read first)` with the brief path and
`bundle-session` command (`paths.tickets_template`); the parent pastes only
that fence. Never two tickets in one chat, never resume a previous ticket's
chat, no code with the anexo itself.
Do not mix a ticket SESSION with an indexing SESSION ([`indexing.md`](indexing.md)).

**One ticket (default):** new agent session, paste the SESSION fence from the
anexo (verbatim). The implementer **must** read
`paths.runs/<anexo-stem>/ticket-N-brief.md` first and runs
`bundle-session --anexo <file> --session N` itself when that file is missing.
No orchestrator required.

**Whole anexo (optional):** `run tickets <file>` (skill `ticket-orchestrator`).
The parent may refresh briefs with `bundle-session` before each spawn; the
implementer still auto-bundles if a brief is missing.
If the design is ambiguous or wrong, **stop and report**; do not invent a variant.

## Written vs run

| Artifact | Owns |
|----------|------|
| [`testing.md`](testing.md) + skill `ticket-testing` | Which tests to write |
| The ticket's Green when, from `stack/<language>/tickets.md` | Which commands must run |
| Validation contract | Attacker rows written at design time; implementers do not run them |

## Last ticket is always remove complexity

Tickets 1..N−1 are feature work (`implementer`, `ponytail` `full`). Ticket N
reads the landed slice, hunts (`graphify`, `ponytail-review` 1–3,
`modular-design`, three symptoms), and removes it (`complexity-remover` at
`ponytail` `ultra` when `tools.ponytail`): no new
behavior, no new public API. The `complexity-remover` agent runs it; its
SESSION block gives scope only (design, unit files, Green when). Line count is not the measure. It does **not** fix
failures owned by earlier tickets: stop and report the owner. Never loosen
asserts, delete tests, or rewrite the slice to green the close. After this
ticket, run that stack's close suite (`stack/<language>/tickets.md`).

## Session briefs

After the **anexo pass** (write or material amend), the parent runs:
`python3 <kit>/cli.py bundle-session --anexo <file> --all` (designer has no
shell; `Next` must name this). Output:
`paths.runs/<anexo-stem>/ticket-N-brief.md` per `## SESSION N`.

Every **implementer** reads its ticket's brief first (see
`stack/<project.language>/tickets.md`). Missing brief: implementer runs
`bundle-session --session N` before any other read. Do not shell-discover the
kit tree.

After the brief: the SESSION fence (Progress, handoff, design slices, named
files). Open BINDING specs by id/section only (`policy/reading.md`). Load skills
on demand per `policy/implementation.md` and `<paths.profile>/skills.md` — not
the whole kit tree.

## Review level

Which reviewers the parent auto-spawns after tickets. `spec-reviewer` after a
design pass is not gated here ([`agents.md`](agents.md)).

Active level, in order:

1. This session: the human named `flexible`, `normal`, or `full` as the review
   mode (also "use flexible", "full-review"). That wins until they name another.
   Do not write `config.yaml`.
2. Else `tools.review` in `config.yaml`.
3. Else `normal`.

Unknown name: stop and ask. State the active level before ticket 1
(`session` or `config`). A named ask ("review this", "attack the contract")
always spawns that agent.

| Auto-spawn | `flexible` | `normal` | `full` |
|------------|------------|----------|--------|
| `code-reviewer` | skip | last SESSION only | every ticket |
| `security-reviewer` / `silent-failure-hunter` | skip | skip | on trigger |

Validation-contract **V-rows** are written at anexo time and exercised by each
ticket's tests and Green-when (`cmd` rows). There is no separate validator
agent; at `full`, the parent may manually attack rows or spawn `code-reviewer`.

The implementer runs Green-when and reports exit codes. The parent trusts that
report; no second agent re-runs the fences. The implementer is not the
reviewer.

## Progress settlement (implementer / complexity-remover)

When the ticket SESSION finishes, the **same agent** updates execution state
(no parent copy-paste):

1. Write the four report headings to
   `<paths.runs>/<anexo-stem>/ticket-<N>.md` (path from the anexo Progress
   section).
2. Edit **only** that anexo's `## Progress` table **row N** and `### Anchor`
   (no other tickets' rows, no design specs, no SESSION fences):
   - **Green-when all passed:** `State` → `GREEN`, `Handoff` → handoff path,
     `Attempts` → previous `Attempts` + 1.
   - **Any required check failed:** `State` → `FAILED`, same `Attempts` bump and
     `Handoff` (report documents the failure).
   - **`Verifier`:** leave `—` unless the report names an independent review
     that already ran; the parent or orchestrator fills it after `code-reviewer`.
3. **Anchor:** merge from this report — cumulative **Files touched so far**,
   **Open issues → owner / Next** (next ticket number when `GREEN`), keep
   **Intent** unless the ticket changed it.

Do not set `GREEN` without passing Green-when. Do not edit Progress before the
report is written. The orchestrator may fix a mistaken row; it does not re-run
Green-when.

**Serial tickets:** rows 1..N−1 `GREEN` mean predecessors settled. If a row is
still `PENDING` but prerequisite files exist, proceed (§ Token discipline) and
note stale rows under **Discovered issues** until those tickets' agents settle
Progress.
