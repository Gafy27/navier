# Factory cleanup audit — 2026-10-15

Factory remains standalone. This cleanup removes contradictory instructions
and adds structural installation checks; it does not certify agent behavior.
The human authorized the kit cleanup without a new product design. No Rust
product sources, review levels, human gates, or CLI protocol were changed.

## Scope and comparison

The structural inventory contains **10 kit roles**, **52 kit skill entrypoints**,
and the selected Rust profile/stack. Reads targeted role instructions,
workflow entrypoints, installer/setup code, their tests, and policy owners.
This is not a claim that every vendored reference or Rust rule was read.

The requested comparison examined pstack revision
`e5136d82418d2db3165ea1050d17577cd618cc05`: its README, mode entrypoint,
and selected playbooks. Useful patterns were one router, targeted leaf reads,
numbered steps, explicit stops, fixed replies, and structural checks. Factory
already had this skeleton; the cleanup removes duplication within it.
Cursor modes, model panels, broad playbook catalogs, and autonomy grants were
not adopted. No Factory instruction depends on pstack, its installation, or
the temporary comparison checkout. No upstream reference file is required
by the resulting workflow, so none was imported. The comparison is historical
audit evidence only; Factory's local policies own all shipped instructions.

## Fixed

- [Installer metadata](install.py#L350): declared role skills survive rendering;
  source references resolve to installed names. Optional flags filter skill
  metadata and appended directives, including the Rust role. Model, effort,
  color, and other declared metadata survive rendering.
- [Structural preflight](install.py#L407), called by installation before
  generated writes and by [setup readiness](setup.py#L87): reject missing or
  dangling skill entrypoints, malformed skill metadata, duplicate role/skill
  names, and skill paths escaping the kit. Name resolution uses the selected
  stack. Removed the unused description-formatting helper.
- [Indexing](skills/indexing/SKILL.md) and
  [design entrypoints](skills/design-docs/SKILL.md) route to policy/templates
  instead of carrying parallel manuals. The research and designer roles use
  those owners. [Factory router](skills/factory-router/SKILL.md) names a task
  row and dependencies, and treats supporting skill resources as optional.
- [Implementer](agents/implementer/instructions.md) and
  [complexity remover](agents/complexity-remover/instructions.md) follow named
  checks plus higher-authority verification. Empty commands are unavailable;
  required checks cannot be silently skipped. Both report successful receipts.
  Graph exploration/refresh uses selected configuration and policy skips.
- [Code reviewer](agents/code-reviewer/instructions.md)
  retains approval/severity contracts without generic size/style dogma.
  [Security reviewer](agents/security-reviewer/instructions.md) reports
  demonstrated boundary defects; it does not remediate or mandate absent tools.
- [Spec reviewer](agents/spec-reviewer/instructions.md) attacks a wrong
  implementation that still passes a row, and may write only a requested
  separate report. [Review policy](policy/review.md) header selections now
  match its existing numbered checklist; no review level changed.
- Retired agents: `code-explorer`, `ticket-validator` (explore via parent +
  graphify; V-rows via ticket tests).
- [Orchestrator](skills/ticket-orchestrator/SKILL.md) requires evidence for
  grandfathering, and [SESSION template](templates/TICKETS.md) includes memory
  and reading pointers. Missing pointers stop dispatch for owner amendment.
  The existing [CLI D6](cli/DESIGN.md) single status trailer remains the narrow
  exception to the unchanged fence prompt.
- [Implementation policy](policy/implementation.md#after-the-diff) explicitly
  states that a local checklist cannot replace required independent review.
  [Rust role](stack/rust/agents/rust-senior-developer.md) keeps core skills and
  routes optional reads; ticket implementation remains a separate role.
- [Sanitizer skill](skills/strong-types-and-sanitizers/SKILL.md) follows named
  configured stages. Custom-profile path pointers use the canonical vault;
  code-style points to the testing owner instead of an absent smoke script.
  The `python-parity` extra exists locally and was retained, without a host
  portability guarantee. Two absent Firecrawl Alexandria skill links now
  point to the installed CLI's help contract. Ponytail/Caveman bodies remain
  untouched. README/loader claims now reflect configurable stack rendering
  and the existing BINDING CLI design.

## Verification receipts

| Check | Outcome |
|---|---|
| `python3 -B -m unittest discover -s factory -p 'test_*.py'` | PASS: 62 tests |
| `python3 -B factory/setup.py check --root .` | PASS: structurally ready; runtime unverified |
| `python3 -B factory/install.py` | PASS: regenerated local host instructions |
| Agent preflight and installed skill resolution | PASS: no problems; 11 kit/Rust outputs resolve skills |
| Edited role/skill/path Markdown links | PASS: 18 documents, zero missing local destinations |
| skill-creator validation of five edited method entrypoints | PASS: indexing, design-docs, factory-router, ticket-orchestrator, strong-types-and-sanitizers |
| `cargo check --workspace -j 4` | PASS |
| `cargo fmt -- --check` | PASS |
| `cargo clippy --workspace --all-targets -j 4 -- -D warnings` | FAIL, exit 101: pre-existing `question_mark`, `bins/cosmos-controller/src/loop.rs:1131` |

[Focused regressions](test_install.py#L187) cover metadata/flag transitions,
idempotence, stack metadata preservation, invalid-contract rejection before
mutation, dangling/malformed skill entrypoints, and selected-stack resolution.
Existing profile-testing and optional-vault fixtures also pass. No Rust unit
was edited, so no crate tests were required. No services or live provider
calls were launched. The earlier [workflow pilot](evals/workflows/2026-10-15/RESULTS.md)
remains limited and inconclusive; it does not measure gains from this cleanup.

## Unresolved choices and limits

- Guard malformed-envelope/missing-command fail-open behavior remains as
  inventoried in [enforcement](policy/enforcement.md). No permission semantics
  were silently changed.
- Review-level costs and the mandatory final complexity pass remain existing
  policy choices. This cleanup does not decide whether to retain or tune them.
- Global plugins/host instructions can add rules outside this kit's control.
  YAML cannot guarantee model availability, delegation, or host skill loading.
- Structural checks cannot prove semantic authority consistency, correct
  agent decisions, or that commands were run. No prose semantic linter or
  speculative snapshot runner was introduced.
- No independent reviewer ran for this cleanup, as requested. These receipts
  are implementation verification, not an independent review or acceptance.
- Clippy is still blocked by the unrelated Rust lint above. Existing dirty
  product/vault/setup work was preserved. No commits, pushes, remote writes,
  dependency installs, or service launches were performed.
