---
doc_type: prompt
topic: factory-obsidian
tags: [doc/prompt, topic/factory-obsidian]
label: Factory review design
open in new tab: true
show when: [doc_type=design, doc_type=program, doc_type=tickets]
show when any: true
order: 30
---
Start a fresh factory design-review parent session. Read AGENTS.md,
factory/config.yaml, the vault README, and the design-review row of
factory/skills/factory-router/SKILL.md; follow its required skills and
factory/policy/reading.md. The selected review request must identify the
canonical note and kind (architecture, program, or anexo):

{{selection}}

Ask for missing identifiers before starting. Dispatch a fresh spec-reviewer
agent with that kind, the relevant sliced-reading instructions, and the
factory role's read-only restrictions. Never review a document yourself.
Record its findings at paths.reviews as the factory allows, without editing
designs, code, gates, comments, or BINDING status. If delegation is unavailable,
stop and report instead of doing the review in the parent.
