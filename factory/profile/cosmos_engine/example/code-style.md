<!-- UNFILLED -->
# Code style (this project)

Language rules: `../stack/<project.language>/code-style.md` (this example:
[`../../stack/rust/code-style.md`](../../stack/rust/code-style.md)).
Comments: `../stack/<project.language>/comments.md`.
Kit tone: [`../../policy/rules.md`](../../policy/rules.md).

- Binaries: `cargo run -p example-controller` / `cargo run -p example-worker`
  (or the language pack's run command).
- Do not assume the operated store's own CLI applies to this repo.
- After the last ticket, a smoke script when a product binary changed
  (name it here).

Rewrite bins and extras. Delete `<!-- UNFILLED -->`.
