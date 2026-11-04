---
description: Spawn named agents by task. Mandatory architecture/program review; optional anexo review.
alwaysApply: true
---

# Agents

Follow [`factory/policy/agents.md`](../../factory/policy/agents.md).

Named agents live in `.agents/agents/` (host `agents/` dirs are
symlinks). If the user's ask matches one, spawn it (Task,
`subagent_type` = the agent `name:`). Do not do its job in the parent.

After a design session writes or changes an architecture or program spec under
`paths.designs`, spawn `spec-reviewer` for that artifact. Do not mark it BINDING
until `VERDICT: ready` and human approval. Agents may record an explicit user
instruction to mark BINDING under `factory/policy/design.md` § User-authorized
BINDING status; do not request the same approval again. Review a `*_TICKETS.md` anexo only
on request; no anexo review verdict is required before running tickets.
Do not write or run tickets until the program sibling is BINDING (unless
grandfathered). After a ticket, auto-spawns follow `tools.review`
(`factory/policy/tickets.md` § Review level). A chat can override the level
for this session; do not write `config.yaml`.

Indexing: parent follows [`factory/policy/indexing.md`](../../factory/policy/indexing.md).
One SESSION per chat.
