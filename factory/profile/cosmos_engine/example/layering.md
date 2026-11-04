<!-- UNFILLED -->
# Layering

Point at the unit map this product owns. Do not paste the whole map here.

Example: a layout file under `paths.designs` (this repo: a `*_LAYOUT.md`).
Workspace members live in the root manifest. Product unit roles are also
in `paths.product_contract`.

To check a unit's inbound graph, run `commands.deps` from
`factory/config.yaml`. Ban rows in the layout file that name a deps
command stay empty.

Inspiration trees are patterns only — never a path dependency. Do not add
a mega-crate that every unit imports. A new unit, a new bin, or a banned
edge is a design change: amend the layout file from a BINDING spec, then
land the manifest.

Rewrite this file for the real product. Delete `<!-- UNFILLED -->`.
