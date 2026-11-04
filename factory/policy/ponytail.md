# Ponytail

When `tools.ponytail` is true in `config.yaml`: **write** agents
(`implementer`, `rust-senior-developer`) follow the skill `ponytail` at
level `full`. The last ticket (`complexity-remover`) follows it at
**ultra**. **Review** of a diff follows `ponytail-review`. It writes the
smallest change that fully solves the task, never cuts validation, error
handling, security, or tests, and ends each write-agent reply with what
it skipped or did not check.

Source: [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail)
5.2.0, MIT. Speech/command bodies are the official skills, copied
verbatim — do not edit `skills/ponytail*/SKILL.md`. Refresh from the
plugin tree (or GitHub tag 5.2.0). Kit overrides live only in this file.

## Precedence

Ponytail ranks below every source in the repo `AGENTS.md` authority list,
and below this kit's policy files. On conflict the higher source wins:

1. "Does it need to exist?" never drops anything a BINDING design or a
   ticket names. A smaller option goes to the report, not into the diff.
2. Design sessions keep the gate rule ([`decisions.md`](decisions.md)).
   Ponytail's "smallest version" is an option to put in a gate question,
   never a silent pick. Spec prose may use the cuts in
   [`design.md`](design.md) § Architecture **Cuts**. That does not load
   this skill on `designer`.
3. Comments follow [`comments.md`](comments.md). Do **not** write
   `shortcut:` comments. List each deliberate shortcut, its limit, and when
   to upgrade it in the reply or ticket report instead.
4. Flatten nesting and the three complexity symptoms:
   [`implementation.md`](implementation.md) § Complexity. Last ticket:
   `complexity-remover` at `ultra` (hunt, then cut). Ultra never drops a
   BINDING D, G, PD, or ticket-named construct; that smaller option goes
   in the report.

## Who loads which skill

| Skill | Agent | When |
|-------|--------|------|
| `ponytail` `full` | `implementer`, `rust-senior-developer` | Every write/refactor |
| `ponytail` `ultra` | `complexity-remover` | Last ticket only |
| `ponytail-review` | `code-reviewer` | After a diff. Report stays the reviewer's format |
| `ponytail-review` hunt | `complexity-remover` | Sections 1–3 on the landed slice **before** editing |
| `ponytail-audit` | none auto | Human: "audit the repo" / `/ponytail-audit` |
| `ponytail-debt` | none auto | Human only. Kit forbids `shortcut:` comments, so the ledger is usually empty |
| `ponytail-gain` | none | Benchmark scoreboard. Not a factory agent job |
| `ponytail-help` | none auto | Claude Code plugin `/ponytail-help` |

Designer, spec-reviewer, research,
security-reviewer, and silent-failure-hunter do **not** load Ponytail.
`silent-failure-hunter` uses [`implementation.md`](implementation.md)
§ Complexity (flat error paths). `rust-senior-developer` stays: it is the
Rust language-pack agent; Ponytail is an overlay, not a replacement.

## Levels

Default `full` on write agents. Last ticket is `ultra`. `lite` only when
the human asks. A human `/ponytail lite|full|ultra` in session overrides
for that chat. `off` when the human says "stop ponytail" or "normal mode".

## Review

`code-reviewer` applies sections 1-3 of the skill `ponytail-review` (read the
code the change touches, grep callers of changed signatures, judge scale
against the expected load, one concrete case per finding) on top of its own
checklist. It reports in its own format. The implementer never runs it on
its own diff as the review. `complexity-remover` runs those same sections
as a hunt of the landed slice, then edits; the parent may still spawn
`code-reviewer` after it returns.

## Hosts

- **Claude Code:** the `ponytail@ponytail` plugin (enabled in
  `.claude/settings.json`) injects the ruleset into the main session and
  every subagent, and adds the `/ponytail*` commands.
- **Cursor and others:** the always-on loader `ponytail.md` and the line
  `install.py` appends to every rendered agent. No hooks needed.
- Keep the plugin and the vendored skills on the same version. On upgrade,
  re-copy every `skills/ponytail*/SKILL.md` and re-check this file against them.
