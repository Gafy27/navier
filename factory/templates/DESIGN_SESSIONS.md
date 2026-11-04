# Design session prompts

Gold template for **authoring** design-session prompts (`*_DESIGN_PROMPT.md`,
unit `DESIGN_SESSIONS.md`). Not a binding design. Not product code.

Policy: `policy/design.md`, `policy/decisions.md`. Anatomy: `paths.design_template`
then `paths.program_template`. Skill: `design-docs`. One fenced block per pass
(architecture, program, anexo). Do not write the anexo block until program BINDING.

Copy this file into a unit folder when many bounded design passes share one
research tree. Fill one fenced block per pass. Paste **one** block into a **new**
agent session. Do not resume an old design chat for the next pass.

## Authoring a fenced block

Each block is self-contained (the agent has no parent history). Include:

1. **Task** — the whole pass in one message (read order, write path, bans).
2. **Done means** — concrete finish line (draft design at path, slice N clauses
   only, the selected artifact registered; architecture/program handed off
   for review, or anexo handed off for execution unless review was requested).
3. **Stop and ask** — when to pause for the owner (see harness below).
4. **Do not** — no product code or tickets run. BINDING needs explicit human
   approval and the review prerequisite in `policy/design.md`. Agents may
   record an explicit user instruction; do not ask for the same approval again.

Do **not** put “think carefully,” “think step by step,” or similar in design
session prompts.

## Rules every design session inherits

### Keep going vs stop

- When a step does not need owner input, **keep going**. Put brief status in
  the same message as the next action.
- **Stop and ask** when:
  - `policy/decisions.md` requires a gate — at most five questions, wait for A/B.
  - You cannot continue without a product choice the locks do not answer.
  - Before anything destructive or hard to undo.
- Do not end with “Want me to continue?” when the finish line is still unmet
  and no gate fired.

Decision gates **override** “keep going” for numbered `D`s and BINDING.

### Long runs

- For a pass that will touch many notes or sections, keep a checklist in
  `TASKS.md` beside the design, tick items as you finish, and add newly
  discovered work.

### Subagents

- Fan out subagents only for **large, independent** tracks.
- Do not spawn subagents to double-check your own draft. Use `spec-reviewer`
  after an architecture/program pass (`policy/agents.md`). Anexo review is
  optional and runs only on request.

### Research and evidence

- Unrun experiments are not evidence. Missing proof → hold, refusal, or owner
  question.
- End research-heavy passes with anything you **could not confirm**, and where
  you looked.

### Handoff format

End every design session (unless the block says otherwise) with:

```markdown
## Blocked on me
## Changed
## Found
```

Under **Found**, include **Could not confirm** when applicable.

## Skeleton file layout

```markdown
# Design sessions — <topic>

Companion to [research sessions](./INDEXING_SESSIONS.md) if present.
Copy one fenced block into a fresh chat.

## Order
| Stage | Output | Prerequisite |
| ----- | ------ | ------------ |
| Architecture | `vocabulary.design_file` | research + D gates |
| Program | `vocabulary.program_file` | architecture BINDING + PD gates |
| Anexo | `vocabulary.tickets_file` | program BINDING |

## Rules every design session inherits

Link this file's § Rules every design session inherits.
Add unit-specific rules below.

## <PASS NAME>

\`\`\`text
<self-contained block: task, done means, stop and ask, read order, write path>
\`\`\`
```
