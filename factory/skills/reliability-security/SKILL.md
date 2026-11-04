---
name: reliability-security
description: >
  MUST load as the first action whenever the user asks for a reliability
  or security assessment of a system. Not for binding specs (use
  design-docs). Trigger: reliability, scalability, redundancy, SLA,
  security assessment, privacy, data integrity, dependency failure,
  backup/restore, assess reliability, security review of a system.
---

# Reliability and security assessment

**First action** when the user asks to assess reliability or security of a
system: read this skill and use its skeleton below. Do not start from a blank
page. Do not fold this into a binding spec.

This is **not** `design-docs`. Binding designs stay under `paths.designs` and
use `paths.design_template`. This is also not
a PR/code security review (Bugbot / security-review of a diff).

## When to use

Whenever the user asks to assess a **running or proposed system** for
reliability, scale, dependencies, data integrity, SLA, security, or privacy —
even if a binding spec already exists.

- New `<paths.reviews>/<system>-reliability.md`
- Update of an existing assessment when the system’s failure/security story
  changed

## When not to use

- Binding specs, tickets, design sessions — `design-docs`
- Reference-codebase indexes — `indexing` skill + `paths.index_pattern`
- Diff/PR vulnerability review — the security-review / Bugbot path
- A section already answered by citing an owning doc *inside* a binding design’s short
  cross-cutting list

## Critical patterns

1. **Answer every heading.** If a section does not apply, state that and why.
   Do not delete it.
2. **Facts, then impact, then mitigation.** Worst-case impact of each relevant
   attack or failure, then the countermeasure. Empty “we should monitor”
   is not an answer.
3. **Dependencies include the quiet ones** — DNS, time, secrets, catalogs,
   brokers, databases, object storage. Name startup-required vs degrade-ok.
4. **No dependency cycles.** If the system cannot start because something it
   starts cannot start, say so.
5. **If there are no security or privacy considerations, say so and why.**
   Silence is not an exemption.

## Repo mapping

| Section | What to ground in here |
|---------|------------------------|
| Scalability | Data size and traffic; what hardware/util this slice actually needs |
| Redundancy and reliability | Transient errors, local loss, backup/restore, partial-loss serving |
| Dependency considerations | Unavailable deps, boot order, cycles (the unit layering doc) |
| Data integrity | How loss is detected, from what, how long to notice, how to recover |
| SLA requirements | What is audited/monitored; how the stated reliability is guaranteed |
| Security and privacy | Relevant attacks, worst case, countermeasures, known-vulnerable deps |

Write to `<paths.reviews>/<system>-reliability.md` (kebab-case), where `{n}` is the
phase whose design owns the system. Start from `paths.reliability_template`. Link the
binding design if one exists; do not duplicate it. Register the file in that phase's
README, in the same change.

Cite the project's secrets design for credentials; do not invent a second secrets story.

## Skeleton

```markdown
# <system> — reliability and security

**Status: draft.** Assessment, not a binding spec.
**System:** <!-- module / service / deployment slice -->
**Binding design:** <!-- path under paths.designs, or none -->

## Scalability

## Redundancy and reliability

## Dependency considerations

## Data integrity

## SLA requirements

## Security and privacy considerations
```

## Quality bar

A ready assessment:

- Uses every heading of the skeleton above
- Names concrete deps, failure modes, and detection/recovery
- States worst-case attack impact and the countermeasure, or an explicit
  “no security/privacy considerations because …”
- Is registered in its phase README

Reject: appended to a `PHASE*.md` spec, skipped headings, “N/A” with no why.
