---
name: latex-docs
description: >
  Edit and create LaTeX documents in this repo (notes, thesis prose, wind-tunnel
  specs). Use when the user mentions LaTeX, .tex, latexmk, a PDF from a tex
  source, citations, or files under investigacion/ or projects/wind-tunnel/docs.
---

# LaTeX in this repo

`pdflatex` through `latexmk`. Match the file you are editing. Do not start a new class, engine, or citation style.

## Which document

| Kind | Where | Language | Preamble |
|------|-------|----------|----------|
| Thesis prose | `investigacion/tesis/tesis_2027.tex` | Spanish (`babel`) | `article`, 11pt, a4paper, `natbib` |
| Concept note | `investigacion/concepts/*.tex` | The language of that file | `article`, 11pt, a4paper |
| Bendat extract | `investigacion/concepts/bendat_piersol/` | English | Keep the existing `newunicodechar` block if you edit that file |
| Solver spec or theory | `projects/wind-tunnel/docs/specs/`, `docs/theory/` | English | `article`, 11pt, `T1` fontenc, `booktabs`, `hyperref` |

A new note is one topic, `\date{}`, no table of contents. A thesis edit goes into `tesis_2027.tex`. Do not create a second thesis file.

## Preamble for a new note

```latex
\documentclass[11pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{amsmath,amssymb}
\usepackage{geometry}
\usepackage{booktabs}
\usepackage{hyperref}
\geometry{margin=2.5cm}
```

Add `tikz` only when the note draws a figure. Add `[spanish]{babel}` only for Spanish prose. Load `hyperref` after the other packages.

## Citations

Thesis bibliography is `investigacion/tesis/citas.bib` with `\bibliographystyle{unsrtnat}` and `\bibliography{citas.bib}`. Cite with `\citet{key}` or `\cite{key}`. Add a BibTeX entry; do not rewrite `citas.bib`. One `\bibliographystyle` in the file.

Notes that already use `\usepackage{cite}` stay on that package.

## Figures, tables, math

- `\graphicspath{{./figures/}}`. Relative to the `.tex` file. No absolute path.
- `\includegraphics[width=0.5\textwidth]{name}` and `\label{fig:...}` after the caption.
- Tables use `booktabs` (`\toprule`, `\midrule`, `\bottomrule`). Label `tab:...`.
- Display math is an `equation` environment. Number it. Do not use `$$`.
- Symbols in math mode (`$U_c$`, `\rho_s`). Do not add a `newunicodechar` line to a file that does not already have that block.

## Build

From the directory that contains the `.tex` file:

```bash
latexmk -pdf -interaction=nonstopmode NAME.tex
```

`investigacion/concepts/.latexmkrc` and `investigacion/tesis/.latexmkrc` set `$out_dir` and `$aux_dir` to `build`. Other folders write the PDF next to the source. Aux files are gitignored (`*.aux`, `**/build/`). Commit the `.tex`. Commit a PDF only when the user asks.

If `latexmk` is missing, run `pdflatex -interaction=nonstopmode` twice.

Read the `.log` and fix the first error. Do not silence it with `[draft]` or by deleting a `\ref`.

## Do not

- Change `graphicspath` in `tesis_2027.tex` to another machine path. Point new figures at `./figures/`.
- Reformat a whole file while editing one section.
- Paste a design spec or an index note into a `.tex` file. Those stay Markdown under `phases/` and `projects/wind-tunnel/docs/design/`.
