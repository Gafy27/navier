# Reading

How agents open files. Tone stays on [`rules.md`](rules.md). Graph-first
exploration stays on [`graphify.md`](graphify.md).

Applies to **you** and **every subagent**. Put this file in that subagent's
prompt when the work opens source, specs, or index notes.

The goal is the smallest slice that answers the question. Full-file reads of
long specs and trees are a defect, not thoroughness.

## Order

1. If the work is code and `tools.graphify` is on, run `graphify query` first
   ([`graphify.md`](graphify.md)). Then open only the paths it names.
2. **Phase spec:** Read the **header** only (Status through **Contents**,
   typically lines 1–~50). Pick the Contents row for the id. Then Read that
   slice. If there is no Contents table, Grep the id (`B-26`, `AUTH-16.3`).
3. Else **search** (`rg` / Grep) for the clause, symbol, or id.
4. **Then** Read with `offset` and `limit` around each hit. Do not open the
   whole file to find a heading.

## Bounds

| File | How to open it |
|------|----------------|
| ≤ ~400 lines | Full read is allowed |
| > ~400 lines | Search, then Read at most **120 lines** per open |
| Phase spec with Contents | Header first, then **one** Contents row's slice |
| Phase spec / phase README / tickets anexo | Search for the id, `§`, or heading; never load the whole file unless the parent named exact lines |
| Same path already read this session | Do not re-read unless the file changed or you need a **different** slice |

Widen a window only when the slice is incomplete for the question. Name why.

## Do not

- `@` or Glob a whole `impl/phases/phase-*` or `inspiration/` tree into
  context
- Re-read `MEMORY.md`, `AGENTS.md`, or a BINDING spec after the first pass
  in the same session
- Browse unused index notes or sibling specs "in case"
- Treat an editor language server (markdown-oxide, rust-analyzer) as a
  reason to skip this file

Index sessions still follow [`indexing.md`](indexing.md): router, then
named paths, then P0 only.

## Parent must not

- Pass a whole phase folder or a 2k-line spec as required reading when a
  clause id is enough
- Drop this file from a researching, designing, reviewing, or
  code-exploring subagent prompt
