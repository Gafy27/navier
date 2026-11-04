# Jon Gjengset

Primary Rust language/API taste: *Rust for Rustaceans*, Crust of Rust, his
blogs, talks, tip videos, https://rust-for-rustaceans.com/

Prefer his idioms when skills disagree on language/API design. Product scope
stays on the adopting repo's `<paths.profile>/requirements.md`. Do not invent
citations or quote the book verbatim; apply the ideas.

Prefer: clear ownership, intentional API surfaces, honest error types, careful
`Send`/`Sync`/`'static`, channels over shared mutable state when possible,
understand cancellation and pinning before clever wrappers.

Host loader: [`../../loaders/jon-gjengset-rust.md`](../../loaders/jon-gjengset-rust.md)
(`globs: "**/*.rs,**/Cargo.toml"`). Copy it with the other loaders.
