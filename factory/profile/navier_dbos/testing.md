# navier-dbos testing

Generic method: [testing policy](../../policy/testing.md).

## Test selection

- This repository holds designs; no test runs here. Every `commands.*` gate in
  `factory/config.yaml` is empty and unavailable.
- Planned (applies in the Navier repository): `node --test` per edited folder
  (`commands.test_scope`), full suite at the last ticket, plus typecheck,
  lint, format, deps. The zip has no `package.json`, so the exact scripts are [U].

## Launch

No launch harness exists here. Planned (P1.5): a disposable Postgres with
Navier migrations and the DBOS system schema, the DBOS worker and API started
as child processes by a `node --test` journey on loopback ports, and a Temporal
dev server only for the frozen adapter's suite.

## Doctor

- Confirm the Navier repository has `package.json` before claiming a command
  runs; the zip under redesign does not.
- DBOS journeys need `DBOS_SYSTEM_DATABASE_URL` equal to the app database
  (P2.5 law); absence blocks only those journeys.

## Drive

| Journey | Owner | Proves |
|---------|-------|--------|
| runner conformance suite on both runners | P1.5 | same rows and statuses for the same scripted turn |
| kill -9 during model step, tool step, pause | P2.5, P6.5 | resume from last step; no duplicate step/action rows |
| stop during streaming | P2.3 | `cancelled`/`interrupted` within one poll interval |
| approval after worker restart | P2.4 | decision wakes the waiting workflow |
| shadow authz | P4.4 | old and new decisions agree or the diff is logged |

## Cleanup

Journeys drop the disposable database and stop child processes they started.

## Execution policy

- An unavailable check is blocked, never a pass.
- Docs-only work needs no runtime journey.

## Evidence

Retain command, exit status and test names. Today only
`python3 factory/cli.py check --root .` and the validator in the root README run.
