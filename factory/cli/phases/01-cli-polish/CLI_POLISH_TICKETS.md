# CLI polish — tickets and session prompts

Two small tickets to exercise the factory CLI end to end. Binding design:
`factory/cli/DESIGN.md`. If anything is ambiguous, stop and report.

## Sequence

```
1 -> 2
```

## Tickets

| # | Ticket | Files it may edit | Green when |
|---|--------|-------------------|------------|
| 1 | `status` prints a final `done N/M` summary line | `factory/cli/src/cli.ts`, `factory/cli/src/run.test.ts` | `node --test factory/cli/src/run.test.ts` |
| 2 | Simplify the landed slice. No new behavior | Only files ticket 1 edited | `node --test factory/cli/src/*.test.ts` |

## SESSION 1 — Ticket 1: status summary line

```
Small change to the factory CLI. Edit only factory/cli/src/cli.ts and
factory/cli/src/run.test.ts.

Read factory/cli/src/cli.ts first. The `status <phase-dir>` subcommand prints one
line per ticket. Make it print one extra final line: `done N/M`, where N is the
number of rows with state done and M is the total number of rows. Change nothing
else, add no dependency, do not touch any other file.

Add one test to factory/cli/src/run.test.ts that runs `status` on a fixture phase
and asserts the last stdout line. Follow the existing tests' style.

Green when: node --test factory/cli/src/run.test.ts

Your working directory is the repo root. Run the Green-when command exactly as
written, as a single command: no `cd`, no `&&`, no pipes. Other forms are rejected.

When green, finish with a short report of what you changed.
```

## SESSION 2 — Ticket 2: simplify

```
Simplify pass on the factory CLI. Edit only factory/cli/src/cli.ts and
factory/cli/src/run.test.ts, the files the previous ticket edited.

Read them and delete or inline anything that is redundant. Add no behavior, no
dependency, no public API. Do not loosen or delete tests. If the code is already
as small as it can be, change nothing.

Green when: node --test factory/cli/src/*.test.ts

Your working directory is the repo root. Run the Green-when command exactly as
written, as a single command: no `cd`, no `&&`, no pipes. Other forms are rejected.

When green, finish with a short report of what you deleted or inlined.
```
