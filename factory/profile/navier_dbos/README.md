# Project profile — navier-dbos

A profile adapts Factory's reusable agents to one project. It tells agents
what the product does, which boundaries they must respect, which project
skills apply, and how to verify their work. It records project facts and
points to their owners; it does not replace the product contract or a binding
design. Authority order when sources disagree:
[`README.md`](../../../README.md) (product contract) wins, then BINDING specs
under `paths.designs`, then this profile.

This directory is the active **navier-dbos** profile. The product is
**Navier**, Gabriel's TypeScript agent runtime (threads, agent messages,
versioned agents, tool catalog, approvals, Postgres delta streaming over SSE).
This repository redesigns how Navier *runs* a turn: DBOS Transact on the same
Postgres becomes the only maintained runner, Temporal stays as a frozen
adapter behind a runner seam, the machinery around the turn workflow is cut
to the minimum, and the gRPC `cosmos.authz.v1` client is replaced by the
owner's **authz-engine** behind an authz seam.

**The repository is design-only.** Phases, designs, programs, tickets,
reviews and research indexes exist; no product code. The code under redesign
is read-only at `/workspace/attach/navier/src` (unzipped `navier.zip`, ~375
files, no `package.json` in the zip). Every code gate in
[`config.yaml`](../../config.yaml) is empty and therefore unavailable.

## How agents load a profile

Read `paths.profile` from `factory/config.yaml` (`factory/profile/navier_dbos`).
Read this `README.md` first, then only the documents the task needs. Before
selecting or running tests read [`testing.md`](testing.md).

## What belongs here

| File | Holds |
|------|-------|
| `README.md` | Profile purpose, identity, routing |
| [`requirements.md`](requirements.md) | Objective, laws, owner decisions, phases |
| [`layering.md`](layering.md) | Navier folders after the redesign, import direction, runner and authz seams |
| [`stack.md`](stack.md) | Technologies and which folder owns each |
| [`code-style.md`](code-style.md) | Pointers to the TypeScript pack + Navier's conventions |
| [`testing.md`](testing.md) | Test selection, journeys, evidence |
| [`skills.md`](skills.md) | Skill bindings |
| [`tickets.md`](tickets.md) | Ticket scope and fences |
| [`agents.md`](agents.md) | Agents and when to use them |

Overlays: `agent-overlays/designer.md` (delegated gates, pt151u) and
`agent-overlays/research.md` (read-only source, cite `tree/path:line`).

## Source trees

| Tree | Root | Pin | Use |
|------|------|-----|-----|
| `navier` | `/workspace/attach/navier/src` | zip 2026-11-04 | Code under redesign; source of truth; cite `navier/path:a-b` |
| `dbos` | `/workspace/dbos-agent/node_modules/@dbos-inc/dbos-sdk` | 5.4.0 (MIT) | Installed SDK type declarations; API facts are `[S]` only when cited here |
| `proto` | `/workspace/dbos-agent` | no-vcs | Owner's DBOS agent prototype (verified on Neon 2026-10-28) |
| `aze` | `/workspace/authz-engine` | design 2026-11-03 | Owner's authz-engine design (BINDING specs there) |

DBOS documentation facts come from docs.dbos.dev read on 2026-11-04 and are
tagged `[Doc]`; anything neither cited nor read is `[U]`.

## Updating this profile

Edit these files, not the generated `AGENTS.md`. Re-run
`python3 factory/cli.py check --root .` then `python3 factory/cli.py install --root .`.
