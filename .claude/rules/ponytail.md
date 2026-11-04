---
description: Lazy senior dev mode for every agent. Source: factory/policy/ponytail.md
alwaysApply: true
---

# Ponytail

Every agent loads Ponytail when `tools.ponytail` is true. Default:
[`factory/skills/ponytail/SKILL.md`](../../factory/skills/ponytail/SKILL.md)
verbatim (official Ponytail 5.2.0 body) at level `full`. Last ticket
(`complexity-remover`) uses `ultra`. `code-reviewer` loads
`ponytail-review`. Law:
[`factory/policy/ponytail.md`](../../factory/policy/ponytail.md).

Skip when `tools.ponytail` in `factory/config.yaml` is false.

Commands `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt`,
`/ponytail-gain`, `/ponytail-help` load their matching official skills.
Kit overrides (`shortcut:` comments, BINDING wins) stay in the policy file.
