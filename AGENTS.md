# navier-dbos

Redesign of Navier's agent turn runtime - DBOS on the same Postgres as the only maintained runner (Temporal frozen behind a runner seam), minimum machinery around the turn workflow, and authz-engine replacing the gRPC authz client - design-only factory

Generated from `factory/config.yaml` by `python3 factory/cli.py install`. Edit the config, then re-run it.

## Commands

- No commands are set in `factory/config.yaml`.

`{unit}` in a command is one `folder`.

## Layout

- Laws: `README.md`
- Import boundaries: `factory/profile/navier_dbos/layering.md`
- Language pack: `factory/stack/typescript/`
- Designs: `phases` (rejected: `phases/rejected`)
- Standards: `factory/stack/typescript/code-style.md`
- Method: `factory/policy/`

## Verification

Before calling work finished, run typecheck, lint, and format. Run the unit test command for each unit you edit. Run the full test command only for a workspace-wide change or the last ticket of an anexo.

## Authority

When two sources disagree, the higher one wins. Stop and report instead of picking.

1. Product contract (`README.md`)
2. A BINDING architecture design in `phases` (never `phases/rejected`). A BINDING program sibling (`vocabulary.program_file`) wins on landing (files, signatures, call graph, seams, call sites); on conflict the architecture spec wins.
3. This file, then `factory/stack/typescript/code-style.md`
4. `factory/profile/navier_dbos`
5. `factory/stack/typescript/`
6. `factory/policy/`

## Hard stops

- No code without a BINDING design that names the unit, unless the human says otherwise. New units also need a BINDING program sibling (`vocabulary.program_file`) before tickets run. Units already BINDING without that sibling are grandfathered until amended.
- No important design choice without a gate question (`factory/policy/decisions.md`).
- No self-review: the implementer is not the reviewer, the designer is not the spec-reviewer.
- No invented scripts: an empty `commands.*` entry does not exist; say so.
- Never log secrets, tokens, or credentials; never commit them. Shell commands follow `permissions` in `factory/config.yaml` (`factory/hooks/guard.py`). Secret files stay blocked.
- The design is silent, ambiguous, or wrong: stop and report.
- Ticket SESSION work: read `factory/policy/tickets.md` § Token discipline (`factory/policy/rules.md` § Token discipline). No pre-edit gate sweeps on serial ticket N > 1; Green when runs after the diff.
- Every agent: **read** `factory/skills/caveman/SKILL.md` at **full** each session (`factory/policy/rules.md` § Caveman).


## Task routing

Load `factory/skills/factory-router/SKILL.md` when the work is research, design, tickets, implementation, review, tests, comments, or a reliability assessment. Follow one row. Do not load every policy file.
