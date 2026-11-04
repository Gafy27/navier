# Implementation

When the work **writes, reviews, or refactors code**. Tests: [`testing.md`](testing.md).
Tickets: [`tickets.md`](tickets.md). Rules every line follows: `paths.standards`,
`<paths.profile>/layering.md`, and the repo rules file.

## Graph first

Explore via [`graphify.md`](graphify.md) when `tools.graphify` is on. Then open exact lines.

## Secure code and naming (MUST)

Read these before implementing or reviewing code; do not skip for a "small" change:

1. `secure-code-writing` (router)
2. Write path: `implementer` **always reads** skill `ponytail` at `full` and
   skill `caveman` at `full` each session (`factory/agents/implementer/`).
   Apply ponytail law when `tools.ponytail`; caveman speech when `tools.caveman`.
   `rust-senior-developer` follows ponytail when `tools.ponytail`. Last ticket:
   `ponytail` at `ultra` on `complexity-remover`. Else § Complexity below.
3. `safe-types-untrusted-input`
4. `strong-types-and-sanitizers`
5. `naming`

Untrusted input is parsed once at the boundary into a branded or schema-derived type.
Code behind the boundary does not validate again. The boundary list for this project is
in `<paths.profile>/requirements.md`.

Apply `naming` to every new or renamed function, type, variable, and constant in the
diff. A reviewer flags a vague name or one that was hard to pick.

## Complexity

Ponytail (when on) is the write-time smallest-change skill (`full` on
write agents). This section is the leftover from the retired
`code-simplicity` skill. Last ticket is `complexity-remover`: hunt
(`graphify`, `ponytail-review` 1–3, `modular-design`, three symptoms)
then cut at `ultra`. Reviewers apply the same list to a diff.

1. **Flatten nesting.** Handle errors as they arise. Nested error branches
   hide authz bugs; early return makes them visible.
2. **Unknown unknowns first.** A silent dependency with nothing linking the
   two values. Then change amplification (one decision copied). Then
   cognitive load (caller must know what the code does not say).
3. **Never mix refactoring with behaviour change** in one commit.
4. **Refactor behind coverage.** Raise tests first; confidence is bounded
   by them. 100% is not proof.
5. Pass-through methods, pull-complexity-down, and extra config knobs:
   last ticket (`complexity-remover` instructions). Do not add a parameter
   this module can compute.

## Stack skills (on demand)

Read `project.language` from `config.yaml` in the kit root, then load
`stack/<project.language>/skills.md` and
`<paths.profile>/skills.md`. The pack map owns
required defaults, task triggers, loading order, and skill entrypoint paths;
load those defaults and only the additional skills the change touches.
Read `stack/<project.language>/implementation.md` when the pack provides it.
Apply this to writing, reviewing, and refactoring code. `project.stack` selects
review checklists, not language-pack skills. A missing configured pack or skill
map is a setup gap: stop and report instead of guessing another language.
Keep diffs minimal and match
the existing conventions of the folder you edit. A third-party import outside its
owning unit is a violation, not a style choice
(`<paths.profile>/layering.md`).

## After the diff

Auto-spawn reviewers per [`tickets.md`](tickets.md) § Review level. The
implementer is not the reviewer. An explicit "review this" always spawns
`code-reviewer`. If a reviewer the level requires is unavailable, run the
`secure-code-writing` checklist against the diff yourself as a local check.
It does not satisfy independent review. Report the required review as blocked;
do not claim acceptance or substitute self-review.
