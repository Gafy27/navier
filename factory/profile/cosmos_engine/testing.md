# Cosmos Engine testing

Generic method: [testing policy](../policy/testing.md). Rust test kinds:
[language pack](../stack/rust/testing.md).

## Test selection

- For a changed crate, run `cargo test -p <crate> -j 4 -- --test-threads=4`.
- For workspace-wide changes or the final ticket of an anexo, run
  `cargo test --workspace -j 4 -- --test-threads=4`.
- Run `cargo check --workspace -j 4`,
  `cargo clippy --workspace --all-targets -j 4 -- -D warnings`, and
  `cargo fmt -- --check` at required completion gates.
- Live RisingWave, Kafka, Postgres, or Iceberg tests are selected only where a
  Green-when clause explicitly names the ignored test. They never use
  production or shared data. The optional integration setup command is empty;
  do not invent a setup command.

## Launch

The bounded binary-pair harness is
`bins/cosmos-worker/tests/live_pair.rs`. Run it through Cargo; it launches
`cosmos-controller` and `cosmos-worker` as child processes, using an in-memory
SQLite catalog and loopback ports. Do not run the child binaries manually or
infer that a build alone launched them.

## Doctor

- Confirm the target crate and tests from the workspace manifests and source.
- Use `cargo test -p <crate> --no-run` when checking whether its tests compile.
- The non-ignored binary-pair journey needs the Rust workspace build tools but
  no external database or broker.
- The ignored provision journey needs reachable RisingWave pgwire (default
  `localhost:4566`, override with `RISINGWAVE_URL`) and `psql`. Check those
  prerequisites only when that journey is explicitly selected; their absence
  blocks that journey, not ordinary Factory installation.

## Drive

For the binary-pair journey, run
`cargo test -p cosmos-worker --test live_pair real_binaries_register_activate_heartbeat_then_apply -- --nocapture`.
It proves the real binaries register, activate product task factories, and
maintain heartbeat/control-stream health with an empty catalog. Despite its
name, this test does **not** submit or apply a pipeline.

The separate ignored journey is
`RISINGWAVE_URL=localhost:4566 cargo test -p cosmos-worker --test live_pair live_pair_foreground_provision_reaches_ready -- --ignored --nocapture`.
It submits a Foreground provision request, checks database/schema readiness,
and drops the generated database. Run it only when explicitly required and
authorized with a private disposable RisingWave instance. Do not use shared or
production data. Find other relevant tests from the changed unit and do not
claim broader behavior than their assertions cover.

## Evidence

Retain the exact command, exit status, and relevant test names/output in the
task report. A test pass establishes only the assertions that test executes.
Preserve requested test artifacts outside cleaned temporary resources.

## Cleanup

The non-ignored journey owns and stops its child processes. The ignored
RisingWave journey creates a process-derived database and attempts to drop it
after assertions; if it fails before cleanup, clean only that generated
database on the same disposable instance. Preserve command output after
cleanup. Never point a test at production or shared data.

## Execution policy

- Run ticket-scoped tests plus an affected behavior journey when observable
  runtime behavior changes.
- Reproduce bugs before and after a fix; run relevant journeys at subphase
  close; run selected or full suites on demand.
- Exercise any changed verification recipe. Docs-only work needs no runtime
  journey.
- An unavailable required check is blocked and unverified, never a pass.
- Execute one available journey before calling a recipe verified. If
  execution is impossible, state the prerequisite and exact unverified scope.
- Installer checks structure, not whether Cosmos Engine works.

## Generic skills

Use Factory's `testing-code`, then `unit-testing` for hermetic tests or
`integration-testing` for explicitly required real dependencies.
