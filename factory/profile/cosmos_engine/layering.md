# Layering

Crate map and dependency law: [`RUST_LAYOUT.md`](../../obsidian/Cosmos%20Engine/phases/RUST_LAYOUT.md).
Do not copy that list here.

Workspace members live in the root `Cargo.toml`. Product crate roles are also
in [`README.md`](../../README.md).

To check a crate's inbound graph, run `commands.deps` from `factory/config.yaml`
(`cargo tree --locked -i {unit}`). Ban rows in `RUST_LAYOUT.md` that name
`cargo tree -p … -i …` stay empty.

`inspiration/` is patterns only — never a Cargo path dependency. Do not add a
`cosmos-core` mega-crate. A new crate, a new bin, or a banned edge is a design
change: amend `RUST_LAYOUT.md` from a BINDING spec, then land the `Cargo.toml`.
