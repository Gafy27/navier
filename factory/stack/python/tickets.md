# Tickets — Python stack (flag-analytics)

Green-when and suite selection for ticket SESSIONs. Profile overrides win when
the anexo or `<paths.profile>/testing.md` names a narrower scope.

## Default gates (this repo)

From `factory/config.yaml` `commands.*` and `projects/flag_analytics/Makefile`:

| Gate | Command |
|------|---------|
| Typecheck | `make -C projects/flag_analytics typecheck` |
| Lint | `make -C projects/flag_analytics lint` |
| Format check | `make -C projects/flag_analytics format` |
| One unit | `make -C projects/flag_analytics test UNIT=<unit>` |
| All units | `make -C projects/flag_analytics test-all` |

`<unit>` must appear in the Makefile `TEST_UNITS` list and in
`<paths.profile>/testing.md`.

## Per-ticket scope

- **Green when runs after your edit**, not before (ticket N > 1 does not re-prove
  ticket N−1 unless the anexo or a handoff requires a pre-edit baseline).
- Run only the **Green when** block in the SESSION fence (and any validation
  `rg`/`cmd` rows in the anexo for that ticket).
- Do **not** run `test-all` unless the ticket or last-ticket close section
  requires it.
- An empty `commands.*` entry in config does not exist; report it as unavailable.

## Session brief

**Required** for every ticket SESSION. Path:
`<paths.runs>/<anexo-stem>/ticket-N-brief.md`.

- After anexo write/amend, parent:
  `python3 factory/cli.py bundle-session --anexo <*_TICKETS.md> --all`
- Implementer: read the brief first. If missing, run
  `python3 factory/cli.py bundle-session --anexo <Anexo from fence> --session N`
  from repo root, then read the output path.

Brief inlines bootstrap laws and points at design slices; do not re-read the
whole kit tree.

## Close suite

Last SESSION (`complexity-remover`): run scoped checks from the anexo **Unit
close** section, then `commands.test_all` when configured.
