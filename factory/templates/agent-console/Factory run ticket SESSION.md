---
doc_type: prompt
topic: factory-obsidian
tags: [doc/prompt, topic/factory-obsidian]
label: Factory run one SESSION
open in new tab: true
show when: [doc_type=tickets]
order: 40
---
Act as the factory ticket orchestrator in a fresh session. Read AGENTS.md,
factory/config.yaml, the vault README, and the run-anexo row of
factory/skills/factory-router/SKILL.md. Load ticket-orchestrator and follow
factory/policy/tickets.md and factory/policy/reading.md. Run only the named
SESSION in the canonical anexo identified by this selection:

{{selection}}

Require the BINDING architecture, BINDING program sibling when required, and
the named SESSION's prerequisites before dispatch. Spawn a fresh implementer
and independent reviewer as the factory requires; the parent does not write
code. Do not execute other SESSION blocks. If this front end cannot delegate
the required agents, stop and report that limitation rather than bypassing it.
