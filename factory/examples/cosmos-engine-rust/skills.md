# Example profile: skills bindings (Cosmos engine, Rust)

Extracted from the skills before they were made portable. These describe the old Rust engine, not this repo. Use as a worked example of what a filled `<paths.profile>/skills.md` holds.

## binary-provenance

## In this repo

Nothing here produces or checks provenance today, and that is proportionate for
a pre-production engine. The honest first steps, in order:

1. Pin what a build consumes: `Cargo.lock` is tracked ✓ — build releases with
   `cargo build --locked`, and add a `rust-toolchain.toml` (absent today) so the
   compiler version is part of the source.
2. Deploy container images by **digest**, not by a floating tag.
3. If provenance is ever wanted, use the ecosystem's format (SLSA / in-toto)
   rather than a bespoke one — the chapter's field list *is* essentially SLSA.

Do not build a signing/attestation stack speculatively; there is no deployment
choke point to enforce it against yet
([`deployment-enforcement`](../deployment-enforcement/SKILL.md)).

## Complexity (was `code-simplicity`)

## In this repo

- Early return over nesting matches the house Rust style: `?`, `let … else`, and
  guard clauses. Do not build a match pyramid to keep one happy path in view.
- YAGNI has teeth here: `CLAUDE.md` already forbids speculative flexibility, and
  the porting law is "mechanical translation of post-simplification Python
  types" — do not invent an abstraction the Python contract does not have.
- Verify with `cargo test -p <crate> -j 4 -- --test-threads=4` before and after
  a refactor. Same tests, same results, no behaviour edits in the diff.
- Note unrelated dead code you find; do not delete it in the same change.

## deploying-code

## Relation to the other repo skills

- Chapters 12 and 13 are [`secure-code-writing`](../secure-code-writing/SKILL.md)
  and [`testing-code`](../testing-code/SKILL.md). This chapter is what makes the
  code you wrote and tested the code that actually runs.
- `reliability-security` assesses a system and writes `impl/reviews/<system>.md`.

## deployment-best-practices

## In this repo

| Control | State today |
|---------|-------------|
| Review | Manual; no CI enforcing it in-tree |
| Automation | `cargo` + `risingwave-compose.s3.yml`; deploys and provisioning are run by hand from a developer machine |
| Config as code | `config/risingwave.toml` and compose files are tracked ✓. `cosmos-catalog.db` — a local SQLite dev catalog — is also tracked; it is dev state, not reviewed config, and it will drift |
| Secrets | `.env` is git-ignored ✓; **`aws.env` at the repo root holds live AWS keys and is not matched by any `.gitignore` rule** — one `git add -A` from a leak. Design story: `impl/designs/PHASE2_SECRETS.md` |
| Verify artifacts | Nothing checks what is deployed; see [`binary-provenance`](../binary-provenance/SKILL.md) |

Before proposing new machinery here, prefer the cheap wins in that table: ignore
patterns for env files, and a decision about whether the dev catalog belongs in
git at all.

## deployment-enforcement

## In this repo

| Concept | The Cosmos analogue |
|---------|---------------------|
| Choke point | The controller is the intended sole writer of RisingWave desired state, via `cosmos-bridge`. But RisingWave accepts pgwire from anyone with credentials, and the compose stack exposes it locally — so today it is a convention, not a choke point |
| Admission decision | The controller's reconcile loop renders a full desired set each pass (`bins/cosmos-controller/src/planner/`) and applies it — it converges state rather than rejecting a request |
| Post-deployment verification | Reconciliation loops already re-derive state continuously — that *is* the "policies change, re-evaluate" property, applied to config rather than to artifacts |
| Breakglass | Manual `psql`/`docker compose` intervention. Unlogged. If you use it while debugging, say so in the change or the ticket |
| Actionable errors | Applies to the planner and provisioning errors: name the object, the expected shape, and the observed one |

Do not add a policy engine here. The available wins are: keep the controller the
only writer, and make drift visible when something else writes.

## dynamic-analysis

## In this repo

Rust removes most of what ASan/MSan/LSan exist to find. What is left:

| Risk | Tool that applies |
|------|-------------------|
| `unsafe` blocks and any pointer/transmute work | Miri (`cargo +nightly miri test -p <crate>`) — detects UB and aliasing violations. Miri cannot run FFI |
| librdkafka (C) via the `rdkafka` dep — the repo's real memory-unsafe surface | Sanitizer-instrumented builds only; a plain `cargo test` will not see it |
| Deadlocks and lock-across-await in Tokio code | Not a data race — TSan won't help. Review + timeouts on live tests; `anti-lock-across-await` in `rust-skills` |
| Where coverage actually is | `cargo llvm-cov` as an occasional signal, not a gate |

Nothing of this is wired today, and that is a defensible choice while `unsafe`
is absent. Do not add a sanitizer pipeline as speculative work; add one the day
a crate gains `unsafe`, or when triaging a suspected librdkafka fault.

Chapter 12's tooling section on the same subject:
[`strong-types-and-sanitizers`](../strong-types-and-sanitizers/SKILL.md).

## framework-adoption

## In this repo

- The compile-time lever is the type system plus `cargo clippy --workspace
  --all-targets -j 4`. Prefer making the wrong call unrepresentable over adding
  a lint.
- Keep the escape hatch visible: a `pub fn` with `unchecked`/`unsafe` in the
  name and a doc comment saying who may call it, not a quietly public field.
- Retiring a helper: add the safe one, migrate callers in the same or a
  following ticket, then delete the old one. Do not leave two ways to do it —
  the codebase is small enough to finish the migration.
- Do not delete Python paths that Phase 2 deliberately kept alive (P2.7 was
  skipped); that migration is out of scope for this skill.

## fuzz-testing

## In this repo

Candidate targets, in order of value — none is wired today:

| Target | Why |
|--------|-----|
| `crates/cosmos-stream/src/codec.rs` — `Event`/`DataPoint` decode | Parses attacker-influenced Kafka payloads; fixtures in `crates/cosmos-stream/tests/fixtures/*.json` are a ready seed corpus |
| Post-decode wire handling in `cosmos-control` | prost decodes the frame, but the code that interprets a decoded message must not panic a worker on a hostile field combination |
| Batch/ingest config parsing | Malformed config should be a typed error, never a panic in a running task |

Rust mechanics: `cargo fuzz` (libFuzzer) with `arbitrary` for structured inputs;
`proptest` — already a workspace dev-dependency — is the cheap in-repo cousin
and the right first step when the input is a Rust type rather than bytes.

In Rust, a `panic!` **is** the crash signal. That means a fuzz finding is
usually an `unwrap`/`expect`/slice-index on a path that must return an error
instead — and it means the driver itself must not `unwrap`.

## hardened-frameworks

## In this repo

| Concern | Where it already lives |
|---------|------------------------|
| Process shell: runtime, signals, panic hook, task lifetime | `crates/cosmos-rt/src/{process.rs,task.rs,panic_hook.rs}` |
| Task lifecycle around every worker task kind | `bins/cosmos-worker/src/host.rs` (`TaskHost`) |
| All outbound connections (RisingWave, Kafka, serving Postgres) | `crates/cosmos-bridge` |
| Retry classification and backoff | `crates/cosmos-bridge/src/retry.rs`, `crates/cosmos-control/src/backoff.rs` |
| Credentials | `impl/designs/PHASE2_SECRETS.md` — one `SecretSource`, no second story |

Before adding logging, retry, auth, or connection code to a bin or task kind:
check whether the seam above already owns it, and extend that instead. Adding a
second implementation is the anti-pattern this chapter is about.

New crates go through [`RUST_LAYOUT.md`](../../../impl/designs/RUST_LAYOUT.md);
dependency direction is part of the guarantee.

## integration-testing

## In this repo

| Practice | Where |
|----------|-------|
| Live tests, one file per dependency | `crates/cosmos-bridge/tests/live_{rw,kafka,postgres,iceberg}.rs`, `bins/cosmos-worker/tests/live_{ingest,sink,batch,pair}.rs` |
| Kept out of the default run | `#[ignore]` + env-gated helpers in `crates/cosmos-bridge/tests/common/mod.rs`; run with `--ignored` and the feature flag named in each file's header |
| Real stack | `risingwave-compose.s3.yml` at the repo root |
| Serialization | live tests run `--test-threads=1` where they share an org/topic; do not parallelize them onto the same fixture |
| Seeding | fixtures and generated org/topic names — never a copy of a customer database or real credentials (`impl/designs/PHASE2_SECRETS.md`) |

There is no CI pipeline in-tree today, so "the live tests still pass" is a claim
someone has to make by running them. Say which ones you ran.

## safe-types-untrusted-input

## In this repo

| Situation | Do this |
|-----------|---------|
| Catalog / store queries | Bind parameters — see `.bind(...)` in `crates/cosmos-catalog/src/backend.rs` |
| RisingWave DDL, where pgwire has no parameters | Build through `crates/cosmos-bridge/src/rw/render.rs` (`SqlBuf`/`Statement`): literals go through `quote_literal`, identifiers through `quote_ident` |
| Secrets inside DDL | `push_secret_literal` — `Statement`'s `Display`/`Debug` print the redacted twin. Never format the raw SQL into a log or error |
| Naming an object | Construct from the `ObjectName`/`OrgId`/`SchemaName` newtypes in `crates/cosmos-bridge/src/rw/ids.rs`, validated at the edge (`LogicalTableId::new`) |
| A new place that builds SQL | Extend `render.rs`; do not open-code `format!("… {} …")` for SQL elsewhere |

Rust has no HTML rendering path here; the `SafeHtml` section is the model for
*why* the SQL types are shaped this way, not a task.

## secure-code-writing

## Relation to the other repo skills

- Chapter 13's companion router is [`testing-code`](../testing-code/SKILL.md):
  these five remove bug classes by construction, those five test for the rest.
- `reliability-security` assesses a **system** and writes `impl/reviews/<system>.md`.
  These five skills apply while **writing code**; they produce no document.
- `design-docs` is for binding specs. Cite a skill in a spec; do not inline it.
- `rust-skills` stays the day-to-day Rust checklist. These skills give the
  security/reliability reason behind several of those rules.

## static-analysis

## In this repo

| Tier | Tool | Use |
|------|------|-----|
| Compile | `rustc` types + `cargo check --workspace -j 4` | The primary analyzer. Prefer making a bug unrepresentable over adding a check for it (see [`framework-adoption`](../framework-adoption/SKILL.md)) |
| Lint / AST | `cargo clippy --workspace --all-targets -j 4`, `clippy --fix` | The code-inspection tier. Treat a needed `#[allow]` as a design smell and say why in the same line |
| Dependencies | `cargo audit` / `cargo deny` | "Components with known vulnerabilities" is an OWASP top-10 item; not wired in-tree today |
| Deep | Miri, Kani | Only with `unsafe` or a stated invariant worth proving. Do not add speculatively |

Keep the noise budget in mind before proposing a new lint: this repo has no CI
to absorb it, so every warning lands on a human immediately.

## strong-types-and-sanitizers

## In this repo

| Rule | Repo state |
|------|------------|
| Memory-safe language | Rust. Keep `unsafe` out; if it appears, `// SAFETY:` and the narrowest scope |
| Newtypes over strings | `crates/cosmos-bridge/src/rw/ids.rs` (`string_id!` — `OrgId`, `DbName`, `ObjectName`, …). Non-interchangeable on purpose |
| Parse at the boundary | `LogicalTableId::new` in `crates/cosmos-catalog/src/lakehouse/ids.rs` returns `None` for dotted/empty names instead of defaulting |
| Units | `std::time::Duration` / typed timestamps. Never a bare `u64` millis in an API |
| Enums over stringly APIs | Project law in `CLAUDE.md`; applies to task kinds, actions, statuses |
| Automated checks | `cargo clippy --workspace --all-targets -j 4`, `cargo test --workspace -j 4 -- --test-threads=4` |

When adding a public function: if two adjacent parameters share a primitive
type, wrap at least one. That is the cheapest bug class to delete.

## supply-chain-threat-model

## In this repo

| Threat surface | Reality today |
|----------------|---------------|
| Direct-to-production writes | RisingWave objects can be created by anyone with pgwire access; the controller's provisioning path is convention, not enforcement. Naming it is the first step (see [`deployment-enforcement`](../deployment-enforcement/SKILL.md)) |
| Config drift | `config/risingwave.toml`, compose files, and env files decide behaviour and are not reviewed as strictly as code |
| Third-party code | Rust deps in `Cargo.lock`; librdkafka (C) inside `rdkafka`; RisingWave and Iceberg operated as products. `cargo audit`/`deny` is not wired |
| Vendored trees | `inspiration/` is git-ignored reference material, not a dependency — it never enters a build |
| Credentials | `impl/designs/PHASE2_SECRETS.md` is the single story; check it before proposing another |

When asked to assess a running system rather than write code, this skill is
input to `reliability-security`, not a substitute for it.

## testing-code

## Relation to the other repo skills

- Chapter 12's companion router is [`secure-code-writing`](../secure-code-writing/SKILL.md):
  eliminate bug classes by construction first, then test for what remains.
- `reliability-security` assesses a system and writes `impl/reviews/<system>.md`.
  These skills apply while writing tests; they produce no document.
- `rust-skills` (`test-` rules) stays the mechanical Rust checklist.

## unit-testing

## In this repo

| Practice | Where |
|----------|-------|
| Unit tests as sibling modules | `*_tests.rs` next to the code (`crates/cosmos-bridge/src/rw/render_tests.rs`, `bins/cosmos-worker/src/core_tests.rs`) |
| Hermetic store | `sqlite::memory:` behind the catalog store trait — no shared DB file |
| Property tests | `proptest` (workspace dep; `crates/cosmos-scheduler/tests/properties.rs`) for invariants a table of cases can't cover |
| Golden tests | `crates/cosmos-scheduler/tests/golden.rs` — rendered output pinned |
| Parser fixtures | `crates/cosmos-stream/tests/fixtures/*.json` — malformed, unicode, missing-timestamp, reserved-tag cases |
| Command | `cargo test -p <crate> -j 4 -- --test-threads=4` (workspace runs only on the last ticket of a subphase) |

Rust specifics worth stating: no `sleep`-based synchronization in tests; make
time and I/O injectable rather than mocking the clock globally. Tests that need
a live RisingWave/Kafka are **not** unit tests — see `integration-testing`.

## verifiable-builds

## In this repo

| Property | State |
|----------|-------|
| Pinned dependency versions | `Cargo.lock` tracked ✓ — use `cargo build --locked` for anything shipped |
| Pinned toolchain | **Missing** — no `rust-toolchain.toml`, so the compiler is whatever the developer has. This is the largest hermeticity gap and the cheapest to close |
| Arbitrary code at build time | `build.rs` (e.g. `tonic-prost-build` in `cosmos-control`) plus the C build for librdkafka — both run on the builder's machine with the builder's privileges |
| Sandboxed builds | None; builds run on developer laptops |
| Reproducibility | Untested. Not worth chasing before the toolchain is pinned |

Rust gives hermeticity cheaply — take the cheap part (`--locked`, pinned
toolchain, digest-pinned base images) and stop there until there is a build
service worth hardening.
