# Tickets (TypeScript)

Kit ticket method: `policy/tickets.md`. Commands: [`config.yaml`](config.yaml).

## Green-when fences

Every ticket runs `commands.typecheck`, `lint`, `format`, `deps` (skip any the
config leaves empty), then `commands.test_scope` for **each** unit folder in
Files it may edit (`{unit}` filled in), then each `commands.conditional` whose
path the ticket touched.

Do **not** run `commands.test_all` except on the last ticket.
Do **not** run another unit's tests unless that unit is in the fence.

A ban (`rg` that must find nothing) passes when it reports nothing.

## Last ticket is always remove complexity

Tickets 1..N−1 are feature work. Ticket N finds complexity by its three
symptoms and removes it (`complexity-remover` at `ponytail` `ultra`): no new behavior, no new public
API. It does not fix failures owned by earlier tickets. After this ticket:
scoped tests, then
`commands.test_all`.
