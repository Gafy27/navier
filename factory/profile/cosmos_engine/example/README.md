<!-- UNFILLED -->
# Profile (examples)

Sibling `*.md` files are **worked examples**: same sections as a real
product profile, with fake names. They are not a product.

**This product** lives in the [active profile](../), selected by
`paths.profile` in `config.yaml` (default `factory/profile`). Agents read
that directory; this example directory is setup material only.

To fill the profile for a new repo:

1. Copy every sibling `*.md` into the active profile directory (including this
   README), replacing the previous product profile. Keep `example/` as the
   portable source; do not copy the directory into itself.
2. Rewrite every `Example Product` / `example-*` name to the real product.
3. Delete every `<!-- UNFILLED -->` line.
4. Set `paths.profile: factory/profile` in `config.yaml`.
5. Fill [testing.md](testing.md) with project-specific Test selection, Launch,
   Doctor, Drive, Evidence, and Cleanup sections based on executable evidence.
   Keep the recipes in this document; do not create a separate testing skill.
6. Run `python3 factory/cli.py check`, then
   `python3 factory/cli.py install`. The installer also rejects a missing or
   incomplete testing document. Installation checks structure; it does not verify
   project behavior.

Do not copy another repo's filled profile (that is how Cosmos got Basilisk
laws). Start from these examples. Other filled samples:
[`../../examples/`](../../examples/).

| File | Holds |
|------|-------|
| [`requirements.md`](requirements.md) | Objective, engine laws, layout, phases |
| [`layering.md`](layering.md) | Unit boundaries, import direction |
| [`stack.md`](stack.md) | Technologies and which unit owns each |
| [`code-style.md`](code-style.md) | Pointers to the language pack + extras |
| [`testing.md`](testing.md) | Live fixtures, what is never mocked |
| [`skills.md`](skills.md) | Skill bindings for this product |
| [`tickets.md`](tickets.md) | Extra Green-when (bins, smoke) |
| [`agents.md`](agents.md) | Extra host agents |

Language method stays in [`../../stack/`](../../stack/). Kit method
stays in [`../../policy/`](../../policy/). Overlays:
`<paths.profile>/agent-overlays/<agent>.md`.

Project-specific test selection and behavior recipes live directly in
`<paths.profile>/testing.md`. Use [testing.md](testing.md) as the portable
starting point.
