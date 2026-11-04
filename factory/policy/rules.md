# Rules

Tone, workflow, code-style principles, gates. Project laws live in
`<paths.profile>/requirements.md`. Code exploration:
[`graphify.md`](graphify.md). Live web: [`firecrawl.md`](firecrawl.md).
Speech: [`caveman.md`](caveman.md) when `tools.caveman` (see § Caveman below).

## Caveman (must read — all agents)

Every agent **reads** [`../skills/caveman/SKILL.md`](../skills/caveman/SKILL.md) at
**full** at session start (SKILL body only; not `reference.md`). Chat reply
speech and fat-CLI shrink follow [`caveman.md`](caveman.md) when `tools.caveman`
is true in `config.yaml`; **still read the skill** when the flag is false.

## Token discipline (must read — all agents)

Any work on a `*_TICKETS.md` SESSION (implement, review, orchestrate, validate):
read [`tickets.md`](tickets.md) § **Token discipline** first and follow it.
Do not burn tokens on pre-edit gate sweeps for serial ticket N > 1; Green when
runs after the diff. Skip long "I will verify baselines first" preambles — act
from the brief and fence.

## Profile documents

Every agent resolves `paths.profile` from the kit's `config.yaml`, relative to
the repository root (an absolute path stays absolute). `<paths.profile>` in
instructions, policies, skills, and templates means that configured directory,
not a directory relative to the current document. The installer default when
the key is omitted or empty is `factory/profile`.

Read `<paths.profile>/README.md` as the profile entry point, then only the
documents the task requires. Role-specific read lists still apply. A missing
required document or skill is a setup gap: stop and report; do not fall back
to another profile. Loading rules are instructions to read files, not a claim
that the installer has already loaded their contents.

Before selecting or running project tests, or reviewing their selection or
recipes, follow `policy/testing.md` and load the configured profile's testing
document. Validation-contract rows still own ticket validation.

## Tone

Caveman speech: § **Caveman** above (read the skill every session). When
`tools.caveman` is false, use the bullets below for reply style instead of
caveman speech rules.

When `tools.caveman` is false:

- Concise and direct. Fewer than 3 lines of text per response when practical.
- No chitchat, no preambles, no postambles, no praise, no superlatives.
- Use tools for actions, text only for communication.
- Minimal words in comments, commit messages, and replies.

## Code style (language-neutral)

- No magic values: a recurring or meaningful value gets a named constant. Values a
  spec states (a status code, a limit) always get one.
- Flat code: early return and `continue`. No arrow anti-pattern.
- Short, specific names. Closed-set parameters over booleans.
- Blank lines between logical blocks.
- Comments follow [`comments.md`](comments.md).
- Language-specific rules live in `stack/<project.language>/code-style.md` and
  `<paths.profile>/code-style.md`.

## Primary workflow

For any non-trivial task: **understand** (read the context before acting), **plan**
(a grounded plan, shared briefly if it helps), **implement** (follow project
conventions), **verify** (run the gates; never mark complete without proof).

## Think before coding

Don't assume. Don't hide confusion. Surface trade-offs.

- State assumptions. If uncertain, ask.
- If several interpretations exist, present them; do not pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop, name what is confusing, and ask.

## Simplicity first

When `tools.ponytail`: [`ponytail.md`](ponytail.md) (smallest complete change).
Else: minimum code that solves the problem. No feature beyond the ask, no
abstraction for single-use code, no unrequested flexibility.

## Surgical changes

When `tools.ponytail`: same file. Else: touch only what you must; clean up
only your own mess. Do not "improve" adjacent code. Mention unrelated dead
code; do not delete it. Every changed line traces to the request.

## Goal-driven execution

Turn the task into a verifiable goal and loop until it holds:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
```

"Make it work" is a weak criterion and needs clarification first.

These guidelines are working if: fewer unnecessary diffs, fewer rewrites due to
overcomplication, and clarifying questions come before implementation.

## Gates

The commands are keyed in `config.yaml` under `commands`: `typecheck`, `lint`,
`format`, `deps`, `test_scope`, `test_all`, `setup_integration`, plus `conditional`
entries that run when a path changed. A command that is empty or missing does not
exist yet: say so, and add only the script the change needs. Ticket fences are in
[`tickets.md`](tickets.md).
