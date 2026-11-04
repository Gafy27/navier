# Cargo gates

Language-neutral ticket method: kit `policy/tickets.md`. This file is the
Rust command set. Merge keys from [`config.yaml`](config.yaml) into the kit
`config.yaml`; do not invent a script the config leaves empty.

## CPU cap

**Default: 4 jobs.** Uncapped `cargo` plus `cargo test` plus rust-analyzer pins
all cores. Prefer `.cargo/config.toml` (`jobs = 4`, `RUST_TEST_THREADS=4`) and
`rust-analyzer.toml` (`extraArgs -j 3`, `check.workspace = false`). Still pass
`-j 4` / `-- --test-threads=4` so a missing config cannot oversubscribe. Do
not run `--workspace` cargo jobs in parallel with each other.

## Commands

- Build (all): `cargo build --workspace -j 4`
- Build one crate: `cargo build -p <crate> -j 4`
- Run: `cargo run -p <bin>`
- Test (all): `cargo test --workspace -j 4 -- --test-threads=4` — human/CI, and
  the last ticket of a unit only.
- Test (one crate): `cargo test -p <crate> -j 4 -- --test-threads=4`
- Lint: `cargo clippy --workspace --all-targets -j 4`
- Format: `cargo fmt`
- Check: `cargo check --workspace -j 4`

Ticket fences: [`tickets.md`](tickets.md). Do not assume another project's
dev-loop script (`./risedev`, `make test`) applies.

Kits map these to `commands.typecheck`, `lint`, `format`, `test_scope`,
`test_all` in [`config.yaml`](config.yaml).
