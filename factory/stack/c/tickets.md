# Tickets (C / Basilisk)

Kit ticket method: `policy/tickets.md`. Commands: [`config.yaml`](config.yaml).

## Green-when fences

Every ticket runs `commands.typecheck`, `lint`, `format`, `deps` (skip any the
config leaves empty), then `commands.test_scope` for **each** unit the ticket
may edit, then each `commands.conditional` whose path the ticket touched.

A solver ticket's typecheck is a `qcc` compile of the translation unit, not
`cc` on a header. A pure-C ticket's test is `cc -Wall -Wextra` on that file.

Do **not** run `commands.test_all` except on the last ticket.
Do **not** run a long `make run` unless the ticket's Green when names a
`CASE` and a `TAG`. A check that exits before `run()` is the default gate.

A ban (`rg` that must find nothing) passes when it reports nothing.

## Last ticket is always remove complexity

Tickets 1..N−1 are feature work. Ticket N finds complexity by its three
symptoms and removes it (`complexity-remover` at `ponytail` `ultra`): no new behavior, no new public
header. It does not fix failures owned by earlier tickets. After this ticket:
scoped tests, then
`commands.test_all` when that command is non-empty.
