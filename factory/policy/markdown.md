# Markdown writing

Conventions for prose `.md` in this repo: phase specs, indexing notes,
`bibliografia/`, demos, and design docs. Code comments and generated stubs
are out of scope unless a spec says otherwise.

**Preview target:** Obsidian (Live Preview or Reading view) with built-in
**KaTeX**. Write math so it renders there without a full LaTeX engine.

Binding designs in `paths.designs` win on product facts. This file governs
form only.

**External references (read for ideas, not as law here):**

- [Google Markdown style guide](https://google.github.io/styleguide/docguide/style.html) — ATX headings, lists, fenced code, links
- [Google developer documentation style](https://developers.google.com/style) — sentence case, clarity, lists vs tables, accessibility
- [MDN — effective technical documentation](https://developer.mozilla.org/en-US/blog/technical-writing/) — clarity, concision, consistency
- [GitHub Docs style guide](https://docs.github.com/en/contributing/style-guide-and-content-model/style-guide) — user-first, scannable structure

This policy adapts those guides to **this** corpus. Where they conflict with
`paths.index_pattern`, BINDING specs, or generated bibliografia, the stricter
repo rule wins.

## How this repo compares to common Markdown practice

| Topic | Typical public-doc style | This repo |
|-------|--------------------------|-----------|
| Document title | One `#` H1, sentence case | Same for index notes and designs; bibliografia chapter READMEs may use title case in tables |
| Section headings | Unique, descriptive; avoid duplicate names like `### Summary` under every H2 | Index notes use **fixed** H2 names from `INDEX_NOTE.md` (`## Answer in plain language`, …)—do not rename them for uniqueness |
| Opening | Short intro, then body | Index notes open with **metadata lines** (`**Kind:**`, `**Question:**`, …) then the prescribed sections—not a generic abstract |
| Evidence | Links to docs | Prefer `path:line` beside claims; link to designs and index notes; optional tags `[S]` source, `[R]` reference, `[A]` algebra, `[X]` executed, `[I]` inference, `[G]` gap where the router defines them |
| Lists | Parallel grammar; punctuate multi-sentence items | Design **Goals** use `**G1 —**` / `**D1 —**` labels; procedures in `## How it works` use ordered steps |
| Line length | Some guides suggest ~80–100 columns in source | Long wrapped paragraphs are normal in indexing notes; still prefer breaking at sentence boundaries over mid-clause hard wraps |
| Links | Descriptive link text | Use meaningful `[text](relative/path.md)`; add anchor (`#heading`) when pointing at one section; `[[wikilink]]` is OK in Obsidian-only notes |
| HTML | Avoid when Markdown suffices | Avoid raw HTML; use tables and fenced blocks |
| Generated files | N/A | `bibliografia/Libros/**` from `chapter_to_md.py`: fix the script, do not hand-edit body text |

When editing an existing note, **match the file’s family** (index, BINDING design, tickets anexo, bibliografia router) before applying generic blog-style rules.

## Structure and headings

- Use **ATX headings** (`#`, `##`, `###`). Do not use setext (`---` under a title).
- **One H1 per file** (the document title). Do not skip levels (e.g. `##` then `####`).
- Put a **blank line before and after** headings and block elements (lists, tables, fences, display math).
- Prefer **sentence case** in headings (`## Key findings and evidence`), except proper nouns, symbols (Γ₂), and locked IDs (`P1.4`, `D3`).
- Task-oriented sections may use a **bare infinitive** (`## Create an instance`) in how-to docs; conceptual index sections keep **noun phrases** (`## How it works`).
- Make heading text **specific** when you add new sections outside the index template (e.g. `### Foo summary` not `### Summary` repeated under every H2).

Index and research notes: page order and section jobs live in
[`indexing.md`](indexing.md) and `paths.index_pattern`. Do not reorder index
sections to match a generic tutorial layout.

## Prose (clarity and scannability)

Aligned with common technical-writing guidance:

- **One main idea per paragraph.** Lead with the conclusion or constraint, then support it.
- **Short sentences** when explaining a trap or a gate; dense paragraphs are OK for evidence chains if each sentence adds a new fact.
- **Active voice** when the actor matters (“the caller binds `origin`”); passive is fine for observations (“the capture lacks `fields_t0`”).
- **Define terms** before abbreviations and symbols; tie notation to the project once (`Γ₂` vs dimensional `Γ`).
- **Avoid vague pointers** (“this”, “it”) when they could mean two referents; name the design, file, or estimand.
- **Do not use hard line breaks** inside a paragraph (no trailing `\\` for wrapping); let the viewer reflow text.
- Break **walls of text** with headings, lists, and tables; put the most important constraint in the **first sentence** of a section.

BINDING specs may use **pass markers** (`[pass 1]`) and bold decision labels (`**D1 —**`); keep that pattern in those files.

## Lists

- **Numbered lists** for sequences (steps, phases, ordered gates).
- **Bulleted lists** for unordered options, findings, or parallel constraints.
- **Parallel structure**: same grammatical form across items (all start with a verb, or all are noun phrases).
- **Introduce lists** with a complete sentence ending in a colon when the list is long or non-obvious.
- For **short single-line** bullets, punctuation may be minimal; for multi-sentence items, end with periods.
- **Nested lists**: indent wrapped continuation lines (four spaces is fine for list content; do not confuse that with four-space **code blocks** for prose or math).

Prefer a **table** when each row shares the same columns (criterion vs implementation, file vs section). Prefer a **list** when items are prose-heavy or uneven in shape ([Google lists guidance](https://developers.google.com/style/lists)).

## Links and paths

- Prefer **relative paths** from the current file to repo assets (`../phase-0/P0.1_XARRAY_DATASET.md`).
- Link text should say **what the reader gets** (“streamed statistics research”), not “click here”.
- For stable in-page targets, use explicit heading anchors (`#answer-in-plain-language`) after checking Obsidian/GitHub slug rules.
- **Long or repeated URLs**: use reference-style links or a single link in Technical references; do not paste the same URL on every mention.
- Cite code with **`path:line`** in prose or tables when precision matters; optional markdown link to the file when navigation helps.

## Code and commands

- Use **fenced code blocks** with a language tag (` ```python `, ` ```bash `, ` ```markdown `).
- Do not use **indented four-space blocks** for prose, math, or multi-line shell—only for nested list continuations.
- **Inline code** for identifiers, flags, env vars, and short literals: `` `fields.bin` ``, `` `make test UNIT=dataset` ``.
- One command per line in bash examples unless the design shows a intentional pipeline.

## Tables

- Use tables for **aligned attributes** (file maps, validation rows, criterion matrices).
- Keep cells short; move long prose **above or below** the table.
- Escape or avoid `|` inside cells; do not rely on display math inside table cells—put equations outside the table when preview breaks.

## Images and diagrams

- Use `![alt text](path)` with **alt text that states the figure’s job**, not “image1”.
- Prefer repo-relative paths under the note’s asset folder (`figures/`, `images/`).
- Mermaid or ASCII diagrams are optional in index notes when they clarify sequence or data flow; they do not replace the required prose sections.

## Equations (Obsidian / KaTeX)

### Delimiters

| Use | Syntax | Do not use |
|-----|--------|------------|
| Display (block) | `$$` on its own line, blank line before and after when adjacent to prose | `\[` … `\]` (does not render reliably in Obsidian) |
| Inline | `$…$` or `\(...\)` | Bare `_` or `^` outside math for subscripts |

Display example:

```markdown
The neighbourhood is

$$
S(P)=\{P+(d_i,d_j):0<d_i^2+d_j^2\le R^2\},\qquad N=|S|.
$$

with $R=2$ on the reference grid.
```

Inline example: `$\overline{\mathbf{u}}_P$` or `\(\Gamma_2(P)\)`.

### Layout rules

- Opening `$$` and closing `$$` each sit on their own line.
- Do not indent the `$$` lines or the equation body (no leading four spaces).
- One display block per equation (or one logically grouped line of derivations).
  Split long displays instead of chaining unrelated formulas in one block.
- Keep punctuation inside the math block when it belongs to the formula
  (e.g. trailing comma before `\qquad`).

### LaTeX style (KaTeX-friendly)

- Vectors: `\mathbf{u}`, `\mathbf{x}` (not `{\bf u}`).
- Operators: `\operatorname{asinh}`, `\frac{a}{b}`, `\int`, `\sum`, `\sqrt{}`.
- Subscripts/superscripts: `x_P`, `u_M`, `r_{\mathrm{eq}}` when text subscripts
  need disambiguation.
- Spacing: `\,`, `\;`, `\qquad` as needed; do not rely on multiple ASCII spaces.
- Prefer `\le`, `\ge`, `\ne`, `\approx` over ASCII digraphs in math mode.

### Avoid in markdown math

- `equation`, `align`, `gather`, and other AMS environments unless you have
  verified KaTeX support for that note.
- `\usepackage`, custom macros, and `\newcommand` (undefined in Obsidian).
- `\\[dim]` row spacing inside matrices—use standard `bmatrix` / `pmatrix` only
  when a matrix is required; test rendering after edits.
- Nesting display `$$` inside callouts or list items without checking preview;
  move the block to normal body text if it fails.

### When math is wrong in preview

1. Confirm **Live Preview** or **Reading** (not Source-only).
2. Replace `\[` `\]` with `$$` `$$`.
3. Search for accidental indentation before `$$`.
4. Simplify unsupported constructs; split into inline `$…$` plus a short prose
   definition.

## File families (quick checklist)

| Family | Location | Follow |
|--------|----------|--------|
| Index / research note | `**/indexing/*.md`, router-linked | `INDEX_NOTE.md` + [`indexing.md`](indexing.md) + this file |
| BINDING design / program | `paths.designs` | Design templates + decision labels; math per above |
| Tickets anexo | `*_TICKETS.md` | Table-heavy validation rows; same link and code rules |
| Bibliografia router | `bibliografia/Libros/**/README.md` | Table of chapters; generated chapter bodies are script-owned |
| Host / kit pointer | `AGENTS.md`, `README.md` | Short, command-oriented; minimal math |

## Authority

Markdown form ranks below binding designs and the product contract. It does
not change scientific claims—only how they are written and rendered.
