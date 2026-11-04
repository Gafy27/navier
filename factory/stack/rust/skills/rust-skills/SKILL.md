---
name: rust-skills
description: >
  Rust coding guidelines (265 rules, 26 categories). Load SKILL.md when writing
  or reviewing Rust; read individual rules/*.md files on demand — never preload all.
  Invoke with /rust-skills.
license: MIT
metadata:
  author: leonardomso
  version: "1.5.1"
---

# Rust Best Practices (compact index)

265 rules in `rules/`. **Read only the files you need** for the current task.

## When to apply

- Writing or refactoring Rust functions, structs, modules, async code, or `unsafe`
- Reviewing ownership, error handling, API design, or performance
- Before adding Clippy allows or new dependencies

## Priority (CRITICAL → LOW)

| Priority | Category | Prefix | Rules |
|----------|----------|--------|-------|
| 1 | Ownership & Borrowing | `own-` | 12 |
| 2 | Error Handling | `err-` | 12 |
| 3 | Memory Optimization | `mem-` | 17 |
| 4 | Unsafe Code | `unsafe-` | 7 |
| 5 | API Design | `api-` | 17 |
| 6 | Async/Await | `async-` | 18 |
| 7 | Concurrency | `conc-` | 4 |
| 8 | Compiler Optimization | `opt-` | 12 |
| 9 | Numeric Safety | `num-` | 5 |
| 10–26 | type, trait, conv, const, serde, pat, macro, closure, coll, name, test, doc, obs, perf, proj, lint, anti | see `rules/` | — |

## Task → categories

| Task | Read rules with prefix |
|------|------------------------|
| New function | `own-`, `err-`, `name-`, `pat-` |
| New struct/API | `api-`, `type-`, `conv-`, `doc-` |
| Async | `async-`, `own-`, `anti-lock-across-await`; also load `fast-tokio` |
| Concurrency | `conc-`, `async-`, `own-` |
| Unsafe | `unsafe-`, `type-`, `test-` |
| Error handling | `err-`, `api-`, `pat-` |
| Serde | `serde-`, `type-`, `api-` |
| Hot path / perf | `mem-`, `perf-`, `opt-`, `anti-format-hot-path` |
| Code review | `anti-`, `lint-`, `err-` |

## CRITICAL defaults (apply without opening files)

- Prefer `&T` / `&str` over owned clones; one owner for mutable state
- `Result` + `?`; `thiserror` in libs, `anyhow` in bins; no production `unwrap`
- `// SAFETY:` on every `unsafe` block; smallest scope possible
- Never hold `Mutex`/`RwLock` across `.await`
- Parse into validated types at boundaries; enums/newtypes over strings
- `tracing` with structured fields; libraries don't install subscribers

## How to load a rule

```
Read .agents/skills/rust-skills/rules/<rule-id>.md
```

Examples: `err-question-mark.md`, `async-no-lock-await.md`, `api-parse-dont-validate.md`

Full upstream index (optional, large): `reference-full.md`

## Release profile (when tuning Cargo)

```toml
[profile.release]
opt-level = 3
lto = "fat"
codegen-units = 1
panic = "abort"
strip = true
```
