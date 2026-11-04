# Rule-to-enforcer inventory

Navigation and coverage inventory, checked against the current kit on
2026-10-15. The linked policies remain authoritative. This file does not
add rules, approve decisions, or change failure behavior. Read it when
changing a rule or investigating a repeated violation, not at session startup.

Scope: every file in `policy/`, plus the root shell/secret hard stops.
Rows group clauses only when their mechanism and limits are the same.
Numbered ranges refer to the owning policy's existing numbers. Language
packs, product laws, and vendored skills retain their own catalogs; this
inventory records their dispatch and enforcement seams, not every leaf rule.

## How to read the tables

| Kind | Meaning |
|------|---------|
| Hook | A registered host hook or permission adapter can intercept an action. Coverage depends on host, event, and payload. |
| Lint | A compiler, formatter, or static check can reject an input when invoked. Its existence does not mean it runs automatically. |
| Test | An executable check can detect the named behavior when invoked with its fixtures. A passing test does not enforce future actions. |
| Prose-only | An agent, human, or reviewer must apply the rule. Templates, skill loading, and prompts belong here unless code checks compliance. |

Each row gives the mechanism, invocation, and known limit. A failure means
the mechanism's rejection or report, not proof that every host stops work.
Review is prose-only even when dispatch is required. Independent context is
not deterministic enforcement. An unrun or unavailable check is not a pass.

## Executable mechanisms

These keys name concrete implementations used below.

| Key | Implementation | Invocation and failure |
|-----|----------------|------------------------|
| Guard | [`guard.py`](../hooks/guard.py): `main`, `secret_reason`, `decide_command`, `emit` | Host supplies a tool request. Recognized forbidden paths/commands produce deny and exit 2. Other cases follow the table below. |
| Hook setup | [`setup/installer.py`](../setup/installer.py): `install_hooks` | Installer registers Cursor shell/tool hooks and Claude `PreToolUse` for Bash/Edit/Write/NotebookEdit. Registration is not a runtime proof. |
| Installer | [`setup/installer.py`](../setup/installer.py): `require_custom_profile`, `require_obsidian_vault`, `require_knowledge_base`, `agent_contract_problems`, `install_agents`, `install_skills` | Explicit installation validates selected paths/profile, then renders and links configured instructions. Invalid prerequisites and structural agent contracts stop before generated-file writes. Preflight checks declared role-name uniqueness, skill references/metadata and duplicate skill names against the selected stack. It does not validate agent obedience, semantic policy consistency, model availability, or host support for metadata. |
| ACP | [`cli/src/acp.ts`](../cli/src/acp.ts): `answerPermission`, `runGuard` | Factory CLI permission requests. Execute without a readable command is rejected; only a parsed guard permission of `allow` grants permission. Startup/error/timeout/invalid output does not grant it. |
| CLI state | [`cli/src/run.ts`](../cli/src/run.ts), [`cli/src/status.ts`](../cli/src/status.ts), [`cli/src/tickets.ts`](../cli/src/tickets.ts) | Explicit CLI run serializes turns and settles status changes. It does not run Green-when, prove behavior, or implement the chat orchestrator's entire policy. |
| Graph integration | [`graphify_obsidian.py`](../graphify_obsidian.py): `Integration` | Configured graph commands validate scope/output paths and generate managed notes. Invalid input raises an error. They do not intercept source reads. |
| Console setup | [`agent_console.py`](../agent_console.py): `setup` | Explicit setup checks configuration/assets and preserves existing settings and prompt files. It does not enforce role dispatch inside a conversation. |
| Installer tests | [`tests/test_install.py`](../tests/test_install.py) | Explicit Python unittest invocation from the kit README. Fixtures cover installer behavior, not live hook execution or agent compliance. |
| Guided setup | [`cli.py`](../cli.py), [`setup/commands.py`](../setup/commands.py), [`tests/test_setup.py`](../tests/test_setup.py), Installer `custom_profile_problems` and `remove_legacy_testing_skill_links` | Explicit setup/check/install. Checks profile structure, populated testing-document sections, then removes legacy project testing-skill links on installation. Fixtures test missing/malformed profiles and prompt preservation. No application behavior is run or certified. |
| Integration tests | [`test_graphify_obsidian.py`](../test_graphify_obsidian.py), [`test_agent_console.py`](../test_agent_console.py), [`test_reducto_kb.py`](../test_reducto_kb.py) | Explicit tests of each integration's fixtures. Coverage is limited to assertions in those files. |
| CLI tests | [`cli/src/acp.test.ts`](../cli/src/acp.test.ts), [`cli/src/run.test.ts`](../cli/src/run.test.ts), [`cli/src/tickets.test.ts`](../cli/src/tickets.test.ts) | Explicit Node tests use fixtures/fake harnesses. They do not establish real-host behavior. |
| Product gates | `commands.typecheck`, `commands.lint`, `commands.format`, `commands.deps`, `commands.test_scope`, `commands.test_all`, named conditional checks in [`config.yaml`](../config.yaml) | Agent/human/CI must invoke the required checks. Command outcomes detect only their own target. Empty keys provide no check. |

## Permissions and host boundaries

Root hard stops are summarized by the generated repo rules. Guard owns the
mechanical subset below; it is a command classifier, not a shell sandbox.

| Rule / case | Kind and mechanism | Invocation / limit |
|-------------|--------------------|--------------------|
| Matching block beats ask, which beats allow; unmatched commands follow ceiling | Hook: Guard `decide_argv` and `decide_command` | Recognized command forms only. Local permission overrides merge by rule id. Allowed interpreters can execute operations the prefix classifier cannot inspect. |
| Protected secret-file and `.git` paths | Hook: Guard `collect_paths` and `secret_reason` | Recognized path keys, traversal depth, list bounds, and filename patterns only. Shell reads/writes, embedded patches, and arbitrary secret values are not comprehensively inspected. |
| Never log or commit secrets | Prose-only beyond the protected-path subset | Guard is not a content scanner or a commit-time secret scanner. The REA evidence scan below has a separate, narrower scope. |
| Parsed forbidden command/path | Hook: Guard `emit` | Emits deny and exit 2. Actual host interpretation requires host verification. |
| Ask decision | Hook: Guard `emit`; ACP | Cursor receives ask; Claude events recognized by capitalization become deny. ACP grants only allow. Host detection is heuristic. |
| Empty stdin, malformed JSON, non-object JSON | Hook: Guard `main`, currently fail-open | Emits allow before loading permissions. This is current behavior, not an endorsed decision. |
| Missing or empty extracted command | Hook: Guard `main`, currently fail-open after path checks | A legitimate non-shell edit also has no command. ACP separately rejects execute requests without one. Guard does not distinguish all missing shell payloads from valid edits. |
| Unparseable shell expression or substitution | Hook: Guard `split_command` | Ask unless ceiling is off. `shlex` splitting is not a full shell grammar; compact separators, wrappers, redirections, and dynamic execution limit coverage. |
| Permission configuration cannot be loaded | Hook: Guard `main`, partial fail-closed | Caught I/O/YAML errors produce deny. Other exceptions can terminate the process; host error behavior then matters. |
| Guard crash, startup failure, or timeout | Hook setup / ACP, host-dependent | Cursor registration sets `failClosed: false`. ACP rejects unavailable/invalid guard results. Do not infer Claude or another host's runtime behavior from registration alone. |
| Hook installation covers all hosts | No general enforcer | Installer wires Cursor and Claude; ACP explicitly calls Guard. No equivalent Codex hook registration is implemented here. Skill links are not permission interception. |

Guard's `--self-check` tests selected permission/path cases. It does not
cover malformed request envelopes or prove host fail-closed behavior.
Changing those behaviors requires a separate decision and change; this
inventory leaves them intact.

## Entry, execution, and code rules

| Policy rule | Kind and mechanism | Invocation / limit |
|-------------|--------------------|--------------------|
| [`README`](README.md): start at repo rules, route one task, load only matching policy; keep method/stack/profile/config ownership | Prose-only: router and policy links | Every session; no loader rejects over-reading or edits in the wrong layer. |
| [`rules` / Tone](rules.md#tone): selected voice, concise communication | Prose-only: Caveman or tone instructions | Agent replies; no speech lint. Installer can distribute instructions, not enforce tone. |
| [`rules` / Code style](rules.md#code-style-language-neutral): constants, flat code, names, closed sets, spacing, comments | Lint: configured compiler/formatter/linter where applicable; otherwise prose-only review | Product gates must run. They do not cover every naming, magic-value, or comment judgment. |
| [`rules` / Primary workflow](rules.md#primary-workflow), Think before coding, Goal-driven execution: understand, plan, disclose assumptions, ask on ambiguity, verify goals | Prose-only: agent workflow | No generic goal/completion verifier. CLI status is a report, not proof. |
| [`rules` / Simplicity first](rules.md#simplicity-first), Surgical changes: minimum scoped change | Prose-only: Ponytail or local instructions, reviewer | No diff-scope or simplicity checker. |
| [`rules` / Gates](rules.md#gates): resolve configured commands; report absent checks | Lint/test: Product gates; prose-only selection and absent-command reporting | Named commands only; no universal runner checks that all required commands ran. |
| [`reading` / Order](reading.md#order): graph first, spec header/Contents, search then slice | Prose-only: reading instructions | All agents; Graph integration cannot prevent a direct file read. |
| [`reading` / Bounds](reading.md#bounds): file-length limits, distinct slices, explain widening | Prose-only | No read-size or repeat-read hook. |
| [`reading` / Do not](reading.md#do-not), Parent must not: no bulk trees/rereads; scoped delegated context | Prose-only: parent and agent instructions | No context-budget or delegated-read validator. |
| [`implementation` / Graph first](implementation.md#graph-first), Secure code and naming: required skills and boundary parsing | Prose-only: skill dispatch and code review; lint/test for specific typed contracts | Compiler proves only encoded constraints. It cannot establish that input was parsed once or the skill was read. |
| [`implementation` / Complexity](implementation.md#complexity): flat errors, hidden dependencies, separate refactor/behavior commits, coverage before refactor, no unnecessary knobs | Prose-only: reviewer and complexity-remover | Existing tests can catch covered regressions; no general complexity or commit-purpose checker. |
| [`implementation` / Stack skills](implementation.md#stack-skills-on-demand): scoped skills, ownership/import law | Lint/test: explicit dependency fences; otherwise prose-only review | Only a named fence detects the corresponding edge. Loading a layering document does not enforce imports. |
| [`implementation` / After the diff](implementation.md#after-the-diff): review-level dispatch, independent reviewer, report unavailable fallback | Prose-only: parent orchestration | No host-wide role or identity check. Self-check fallback is not independent review. |
| [`testing` / Load order](testing.md#load-order): matching test skill; tickets also load ticket-testing | Prose-only | No skill-read check. |
| [`testing` / Written vs run](testing.md#written-vs-run): test-writing, Green-when, validator ownership | Prose-only: ticket contracts and agent roles | CLI does not execute Green-when itself. |
| [`testing` / Rules](testing.md#rules): unit default; justified integration; no speculative fuzz/sanitizer pipeline | Prose-only: design and test review | No test-kind or dependency-use gate is installed by this policy. |
| [`testing` / Rules](testing.md#rules): real owning clients, approved fakes, private fixtures, no live third parties | Prose-only: test review | No network isolation or fixture-origin checker supplied by policy. |
| [`testing` / Rules](testing.md#rules): preserve assertions/bans; contract tests use public entrypoints | Test: behavior assertions; lint for genuinely private APIs; otherwise prose-only review | Tests cannot prevent their own weakening. Public-but-forbidden imports may still compile. |
| [`comments` / Rules 1–2](comments.md#rules): one line, shorter than code | Prose-only: comment review | No comment-length lint. |
| [`comments` / Rules 3–5](comments.md#rules): useful meaning, needed only, simple complete contract | Prose-only: comment/design review | Semantic judgment. |
| [`comments` / Rules 6–9](comments.md#rules): no boilerplate, unread tags, history/task talk, commented-out code | Prose-only: comment review | No corresponding lint configured here. |
| [`comments` / Rule 10](comments.md#rules): no secret/claim values | Prose-only; protected-path Hook is only a subset | No general content scanner. |
| [`comments` / Where the long text goes](comments.md#where-the-long-text-goes), Review check | Prose-only: reviewer | No content-placement or mandatory-review interception. |

## Design, review, phases, and tickets

| Policy rule | Kind and mechanism | Invocation / limit |
|-------------|--------------------|--------------------|
| [`decisions` / What is a gate](decisions.md#what-is-a-gate): important product/security picks require human input; routine frozen choices do not | Prose-only: designer and human | No classifier identifies all expensive or trust-boundary choices. |
| [`decisions` / Where locks live](decisions.md#where-locks-live): source authority, no silent lock/reversal | Prose-only: designer/reviewer | No lock or approval store enforced by hook. |
| [`decisions` / How to ask](decisions.md#how-to-ask), Research before asking: researched options, at most five questions, explicit pick | Prose-only | No question-format, research, or explicit-answer validator. |
| [`decisions` / Architecture vs program design](decisions.md#architecture-vs-program-design), Recording: D/PD ownership, lifecycle, changelog | Prose-only: spec-reviewer | No machine gate checks D/PD approvals. |
| [`design` / opening rules](design.md): required skills/templates, sliced context, canonical outputs, no product code | Prose-only: designer and spec-reviewer | Installer emits instructions; it does not fence designer writes. |
| [`design` / Editing a spec 1–5](design.md#editing-a-spec): rewrite clauses, pass markers, retire ids, changelog, binding-through-pass | Prose-only: spec-reviewer | No pass/id/status parser verifies these clauses. |
| [`design` / Three passes](design.md#three-passes): architecture then program then anexo; independent review/human binding; grandfather limits | Prose-only: designer/orchestrator | CLI does not independently prove binding prerequisites or approval. |
| [`design` / Architecture](design.md#architecture-pass-1): trade-offs, scope, length, Redaction/Cuts, no duplicated laws or landing bulk | Prose-only: spec-reviewer | Page/line guidance and semantic cuts have no enforcing lint. |
| [`design` / Program design](design.md#program-design-pass-2): signatures, layout/call graph or mini-doc, seams, call sites, PD scope | Prose-only: spec-reviewer | Templates aid authoring; no completeness/schema checker. |
| [`design` / Anexo](design.md#anexo-pass-3): program-aligned fences, validation contract before code, named commands | Prose-only: designer; spec-reviewer only on request; test mechanisms only after rows run | Writing rows does not execute them. |
| [`design` / Design session prompts](design.md#design-session-prompts): self-contained pass, done means, persistence until gate, handoff | Prose-only: prompt template | No prompt-conformance lint. |
| [`review` / opening rules](review.md): fresh read-only reviewer, relevant kind/prerequisites, sliced claims, verdict/file destinations | Prose-only: parent and reviewer | Role separation and read-only tools depend on the host and dispatch. |
| [`review` / Severity](review.md#severity), After the review: blocker threshold, answers, re-review, explicit human binding | Prose-only | No verdict/approval state machine prevents premature implementation. |
| [`review` / Checks 1–7](review.md#what-to-check-from-past-reviews): observable attacks, accepted/near-miss cases, tool/include/seam availability, contradictions, type holes | Prose-only: spec-reviewer; test/lint when concrete rows execute | Review detects inadequate tests through judgment; existing tools only check inputs they actually receive. |
| [`review` / Checks 8–10](review.md#what-to-check-from-past-reviews): consistent standards, law/D/PD coverage, hardcoded configuration | Prose-only: spec-reviewer | No coverage/configuration-value lint. |
| [`review` / Checks 11–14](review.md#what-to-check-from-past-reviews): architecture scope/redaction, program artifacts, anexo alignment | Prose-only: spec-reviewer | No document-shape or cross-file semantic checker. |
| [`review` / finding format](review.md#what-to-check-from-past-reviews): location, quote, cheating implementation, concrete fix | Prose-only | No finding-quality validator. |
| [`phases` / Folder layout 1–4](phases.md#folder-layout): ownership, creation timing, stable ids, cross-phase placement | Prose-only | Installer checks selected directories, not phase layout or id reuse. |
| [`phases` / What the phase README holds](phases.md#what-the-phase-readme-holds), The file table, What the README does not hold | Prose-only: phase template and review | No inventory/status/reciprocal-amendment validator. |
| [`phases` / Keeping it true 1–5](phases.md#keeping-it-true), Opening a phase | Prose-only | Same-change registration, hot-file edits, retirement/rejection placement are not intercepted. |
| [`tickets` / prerequisites](tickets.md): binding siblings/grandfathering, language fences | Prose-only: chat orchestrator | CLI discovers SESSIONs but does not validate design authority. |
| [`tickets` / Isolation](tickets.md#isolation): one fresh SESSION, no resuming/mixing, stop on ambiguity | Prose-only: chat orchestrator; CLI state supplies serial turns | Serial execution is not proof of fresh context, correct role, or design compliance. |
| [`tickets` / Written vs run](tickets.md#written-vs-run): writing vs running vs validation ownership | Prose-only; lint/test for invoked rows | No universal receipt checker. |
| [`tickets` / Last ticket](tickets.md#last-ticket-is-always-remove-complexity): hunt/cut only, no weakened checks or inherited fixes, close suite | Prose-only: complexity-remover/reviewer; test/lint for close gates | No mechanical check of ticket purpose, allowed API changes, or assertion weakening. |
| [`tickets` / SESSION read list](tickets.md#session-read-list) | Prose-only: SESSION templates and instructions | No read-order audit. |
| [`tickets` / Review level](tickets.md#review-level): session override then config/default, announce level, named asks always dispatch | Prose-only: chat orchestrator | No deterministic session-override or reviewer-dispatch validator. |
| [`tickets` / Review-level table](tickets.md#review-level): flexible/normal/full reviewer and validator schedules | Prose-only: chat orchestrator | `normal` runs code-reviewer only at last SESSION and skips validator; `full` runs it after GREEN. No independent fence rerun is required. |
| [`tickets` / Progress settlement](tickets.md#progress-settlement-implementer--complexity-remover): implementer updates row + Anchor after report | Prose-only: chat orchestrator; CLI state protects its separate status file | CLI settlement restricts row changes; anexo Progress is the execution record. |
| [`agents` / Mechanism and fallback](agents.md): named roles, self-contained prompts, bounded tools, durable output, disclose fallback | Prose-only: parent dispatch | Host tool restrictions may limit an individual process; no general role-dispatch enforcer. |
| [`agents` / Map](agents.md#map): canonical agent sources, generated host copies | Installer distributes sources | No prohibition on subsequently editing generated copies; regeneration can overwrite them. |
| [`agents` / Design then review](agents.md#design-then-review-mandatory): fresh critic, review/fix loop, human binding, no premature tickets/code | Prose-only | No hook checks author/reviewer identity or binding evidence. |
| [`agents` / After implementation](agents.md#after-implementation), Parent must not: triggers, no private-memory ticket worker, no resumed critic/author, required tools and memory | Prose-only: role policies and orchestrator | Installer makes roles/skills available; availability does not prove dispatch or compliance. |

## Research and evidence

| Policy rule | Kind and mechanism | Invocation / limit |
|-------------|--------------------|--------------------|
| [`indexing` / first action and Session 1–5](indexing.md#session-like-tickets): templates, one question/note/session, hot router, no code, locks, live evidence | Prose-only: research agent | No note/session-count, scope, or evidence-freshness gate. |
| [`indexing` / Index router](indexing.md#index-router-the-runbook): objective, exits, defaults, gaps, reading order, notes, sessions | Prose-only: template and research review | No router completeness checker. |
| [`indexing` / Research order](indexing.md#research-order): pin/graph/grep/index/web order, scope recovery, sources win, bounded reads, optional/required REA | Prose-only | Search tools execute requests; they do not enforce the research sequence or source hierarchy. |
| [`indexing` / After the note 1–4](indexing.md#after-the-note): ready criteria, same-change registration, human gates, no binding from index | Prose-only | No note-promotion or binding-status interception. |
| [`firecrawl` / Route first](firecrawl.md#route-first), Laws 1–3: matching skill, CLI/provider selection, scope/filter semantics | Prose-only: Firecrawl instructions | No restriction prevents an agent from using another network tool or wrong query. |
| [`firecrawl` / Laws 4–6](firecrawl.md#laws): resolution evidence, follow-up scrape, corpus not product map | Prose-only: research review | A successful scrape does not establish authority or completeness. |
| [`firecrawl` / Law 7](firecrawl.md#laws), Indexing, Install: shrink large output, correct search kinds/order, configured tooling | Prose-only: agent workflow | Skill installation is structural; invoking the right tool and retaining sufficient evidence are not checked. |
| [`rea` / When](rea.md#when), How to call, Ask small 1–4: configured/pinned surface, named target, bounded evidence | Prose-only: REA workflow | Tool success does not prove permitted target selection, query scope, or correct version use. |
| [`rea` / Check every answer 1–7](rea.md#check-every-answer): compare key, evidence ids/labels, names uncertain, second tool, observed result | Prose-only: research review | No citation/confidence/corroboration validator. |
| [`rea` / Limits 1–4](rea.md#limits): static first, runtime isolation, authorized targets, prohibited uses, respect refusals | Prose-only | Policy provides no VM sandbox or service-authorization enforcement. |
| [`rea` / Browser 1–5](rea.md#browser): human login, passive default, named scratch for driving, forbidden writes, close browser | Prose-only | Loopback debugging does not constrain actions to the authorized scratch target. |
| [`rea` / Evidence 1–3](rea.md#evidence): local bulk, retained records, minimal values | Prose-only | No general output-path or data-minimization gate. |
| [`rea` / Evidence 4–6](rea.md#evidence): secret regex before commit, no HAR commits, cited confidence/unknowns | Lint: explicit `rg` scan in policy; otherwise prose-only | Agent must run it and act on hits. Regex is incomplete; no commit hook invokes it. |
| [`rea` / Install](rea.md#install): prerequisites and matched skill/tool version | Prose-only; Installer links enabled skill | No automatic prerequisite installation or runtime version gate. |
| [`reliability` / steps 1–3](reliability.md): skill/template, separate assessment destination, no binding/code conflation | Prose-only: assessment author | No document-kind or scope checker. |

## Memory, vault, and optional overlays

| Policy rule | Kind and mechanism | Invocation / limit |
|-------------|--------------------|--------------------|
| [`memory` / What it is](memory.md#what-it-is), Every session: shared own repo, startup read, selective recall, useful writes, commit/no push | Prose-only: memory skill; Hook for recognized blocked push | No mandatory read/write/commit checker. Guard coverage is limited as above. |
| [`memory` / Authority](memory.md#authority), Do not save: data below authority; no secrets, copied rules, scratch, gate decisions | Prose-only: agents and reviewers | No memory-content or authority validator. |
| [`memory` / Concurrent writers](memory.md#concurrent-writers): clean status, retry/skip, stage own files, no reset/force | Prose-only: explicit git checks and agent workflow | No transaction lock enforcing the complete workflow. |
| [`memory` / read-only agents and Parent must not](memory.md#parent-must-not): ready-to-save reports, parent disposition, include memory policy | Prose-only: role/parent handoff | No handoff-consumption or prompt validator. |
| [`obsidian` / optional vault and knowledge base](obsidian.md#optional-knowledge-base-pathsknowledge_base): validate enabled roots/index; local overrides | Installer rejects missing configured prerequisites | Directory presence does not establish correct routing or source authority. |
| [`obsidian` / knowledge-base usage](obsidian.md#optional-knowledge-base-pathsknowledge_base): filtered INDEX, separate vault, conventions, reference snapshots below canonical designs | Prose-only | No cross-vault authority or tag-filter enforcement. |
| [`obsidian` / PDF ingestion](obsidian.md#optional-knowledge-base-pathsknowledge_base): explicit bounded parse, source/page attribution, untrusted derived content, preserve edited output | Test: Integration tests; importer checks in [`reducto_kb.py`](../reducto_kb.py); otherwise prose-only | Importer can reject protected output collisions; it cannot validate every human quotation or source interpretation. Ordinary install does not parse/upload. |
| [`obsidian` / Every agent 1–4](obsidian.md#every-agent): startup router, configured canonical destinations, direct edits, unchanged authority | Prose-only; Installer distributes startup pointers | No mandatory startup-read or canonical-edit interception. |
| [`obsidian` / Every agent 5–6](obsidian.md#every-agent): relative links, quoted paths, hot reads, preserve metadata/settings | Prose-only | No general link/move/comment-preservation or `.obsidian` write guard. |
| [`obsidian` / Properties and tags](obsidian.md#properties-and-tags): metadata shape, status authority, preserve existing fields | Prose-only: templates | Installer copies the capture template; no general frontmatter validator enforces note semantics. |
| [`obsidian` / Generated code map](obsidian.md#generated-code-map): managed notes, scoped provenance, preserve unrelated notes, commentary elsewhere | Graph integration checks output scope/managed files; Test: Integration tests | Explicit refresh/export only. No hook prevents manual edits or treating generated notes as authority. |
| [`obsidian` / Design comments](obsidian.md#design-comments): read threads, preserve markers/history, no unauthorized resolution, read-only reviewer | Prose-only | No marker-preservation or resolution-authority validator. |
| [`obsidian` / Adopt in another project](obsidian.md#adopt-in-another-project): optional explicit console setup, preserve settings/prompts, fresh kickoffs and delegation | Console setup and Integration tests for setup; prose-only for kickoff conduct | Existing settings win via defaults. Saved prompts request delegation but cannot guarantee it. |
| [`graphify` / Before exploring](graphify.md#before-exploring): selected graph, quoted configured commands, query before code, explicit skips | Graph integration validates its selected scope; otherwise prose-only | Direct source reads and alternate CLI invocations bypass the helper. |
| [`graphify` / Refresh and Obsidian](graphify.md#refresh-and-obsidian): refresh touched sources, managed notes, local AST, no unsolicited full extraction | Graph integration and Integration tests for generated outputs; prose-only dispatch | No change hook forces refresh or prevents a separate semantic extraction. |
| [`graphify` / Install](graphify.md#install): configured skill linkage and machine prerequisite | Installer links enabled skill | No guarantee that the executable exists or agent uses it. |
| [`ponytail` / Precedence 1–4](ponytail.md#precedence): binding scope/gates win, report smaller alternatives, no shortcut comments, preserve required behavior | Prose-only: policy overlay and review | No semantic scope/gate/comment validator. |
| [`ponytail` / Who loads which skill](ponytail.md#who-loads-which-skill), Levels: write full, close ultra/hunt, review overlay; human-only audit/debt/gain/help | Installer gates links and appends selected kit-role instructions; otherwise prose-only | Instruction presence is not execution. Selected-stack metadata and appended directives follow configured flags; session overrides are not machine-validated. |
| [`ponytail` / Review](ponytail.md#review): connected-code review, one concrete case, independent critic | Prose-only: reviewer dispatch | No role-identity or review-quality gate. |
| [`ponytail` / Hosts](ponytail.md#hosts): matching official version, verbatim vendored bodies, host integration | Prose-only; Installer distributes local copies | Installer does not compare upstream hashes or installed plugin versions. |
| [`caveman` / Precedence 1–5](caveman.md#precedence): authority, code ownership, memory separation, chat-only voice, kit-English artifacts | Prose-only: overlay and agents | No speech/artifact lint or tool prohibition implemented here. |
| [`caveman` / CLI](caveman.md#cli): shrink specified large dumps, disclose missing binary, avoid excluded commands | Prose-only: agent command selection | Linking a skill does not install the CLI or make wrapping automatic. |
| [`caveman` / Hosts](caveman.md#hosts), Install: enabled aliases, official body, external Claude proxy | Installer gates skill links and appends kit-agent pointers | Machine proxy/hooks are outside kit ownership; no proxy health/version check during install. |

## Workflow instruction checks

Indexing and the research, implementer, designer, and code-reviewer agent
instructions carry numbered sequences, stop conditions, and fixed handoff
fields. These remain prose-only. Installer rendering distributes them;
it does not prove the steps ran. The
[workflow pilot](../evals/workflows/README.md) is an explicitly invoked
comparison using saved artifacts and executable fixture checks, not an
automatic gate or independent code review. Its recorded limits remain
part of the result.

## Keeping the inventory useful

When an existing policy rule or mechanism changes, update its row in the
same change. Link the owner instead of copying the full rule. Split grouped
clauses when their enforcement differs. Add a new policy file's rows before
claiming full policy coverage.

A repeated violation is evidence to inspect the mechanism, not proof that
another prose rule will help. Record proposed enforcement separately from
what exists today. Prefer a structural fix where justified, but retain
prose-only entries for decisions that require judgment. Do not promote a
test into an automatic gate without identifying what invokes it.
