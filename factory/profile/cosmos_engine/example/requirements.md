<!-- UNFILLED -->
# Requirements

Laws for **this** product. Agent behavior:
[`../../policy/rules.md`](../../policy/rules.md). Language pack:
[`../../stack/`](../../stack/) (this example: rust).

Rewrite every `Example Product` / `example-*` name. Delete `<!-- UNFILLED -->`.

## Objective

**Example Product** is a **control plane and runtime** for agent-built
data apps. This repository is the language-pack runtime: catalog, workers,
and gRPC. **Operated compute** (a store you run, not rewrite) sits beside
it. Specs in `paths.designs` and shipped units are authoritative.

An older prototype tree, if any, is **not** a parity target and must not
gate design or implementation.

Inspiration trees are patterns, not a fork. Do not rewrite the operated
store's engine.

## Engine laws

- Workers have no catalog access; the control plane is a renderer plus store
- One write door for product state (name the verb the design froze)
- Operated compute is operated, not rewritten
- Unit code lands only against a BINDING spec in `paths.designs` that names
  the unit
- Dependency direction: workers → control crate only, not catalog /
  scheduler ([`layering.md`](layering.md))

## Architecture

**example-controller** — control plane: desired-state catalog, admission,
reconcile loop, scheduler, apply to the operated store, worker
orchestration.

**example-worker** — task host. No catalog access.

Control-plane crates: `example-control`, `example-catalog`,
`example-scheduler`. Data-plane crates: `example-bridge`, `example-sink`.
Foundation: `example-rt`.

Data flow: User/API → apply → controller → admission → catalog →
reconcile → assign → worker → external systems.

## Repository layout

| Path | Role |
|------|------|
| `factory/` | Agent kit (examples in `profile/example/`, active `profile/`, `policy/`, `stack/`) |
| workspace manifest | Root only — no root package if the language pack forbids it |
| library units | Named in the crate/package map |
| bins | `example-controller`, `example-worker` |
| layout file | Unit map, binary roles, dependency law (`paths.decision_log`) |
| `paths.designs` | Specs + `*_TICKETS.md`; indexing, reviews |
| inspiration tree | Reference codebases (`paths.reference_trees`) |

## Phases

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Process shell | example |
| 1 | Control plane | example |
| 2 | Data plane | example |

Do not start unit code until `paths.designs` names the unit.

## Design research before asking

1. Indexes under the phase indexing tree. Method: `paths.index_pattern`.
2. Official docs the index cites — vocabulary only.
3. Source paths the index cites. On conflict, **source wins**.
4. Then stop and ask per `policy/decisions.md`.
