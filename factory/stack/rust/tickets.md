# Tickets (Rust)

Kit ticket method: `policy/tickets.md`. This file is the Cargo Green-when
fence. Commands: [`cargo.md`](cargo.md). How tests are written:
[`testing.md`](testing.md) and kit skill `ticket-testing`.

## Green-when fences

A ticket's **Green when** is the required list. Run it, not a broader suite
and not a thinner one.

For **each** crate in Files it may edit:

```
cargo fmt
cargo test -p <crate> -j 4 -- --test-threads=4
cargo clippy -p <crate> --all-targets -j 4 -- -D warnings
```

Plus extra filters / `--ignored` live rows / leak fences (`cargo tree -i`,
`rg`) that ticket's Green when names.

Do **not** run `cargo test --workspace` except on the last ticket.
Do **not** run `-p <other-crate>` unless that crate is in the fence.

A non-zero exit from a `cargo tree -i` fence **is the pass**. Do not "fix" it.

Do **not** run `commands.typecheck`, workspace `clippy`, or `commands.deps` on
every ticket. Those are human/CI. Per-ticket gates are the three commands
above. Workspace `cargo test --workspace` is ticket N / CI only
([`cargo.md`](cargo.md)).

## Last ticket is always remove complexity

Feature work is tickets 1..N−1. Ticket N reads the landed slice, finds
complexity by its three symptoms, and removes it (`rust-skills` + kit
`complexity-remover` at `ponytail` `ultra`). No new behavior, no new public API.

Ticket N does **not** fix failures owned by tickets 1..N−1. Stop and report
the owning ticket. Do not loosen asserts, delete tests, or rewrite the slice
to green the close.

After this ticket: named crate tests, then
`commands.test_all` (`cargo test --workspace -j 4 -- --test-threads=4`), plus
live rows saved for close. Product extras (smoke script, which bins):
`<paths.profile>/tickets.md` if that file exists.

## SESSION read list (Rust extra)

After the kit read list, feature tickets also read:

1. [`skills/rust-skills/SKILL.md`](skills/rust-skills/SKILL.md) — only the
   `rules/<id>.md` this ticket needs
2. [`implementation.md`](implementation.md) if the ticket uses Tokio
