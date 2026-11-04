---
name: deployment-enforcement
description: >
  Where the deployment check runs (choke points), why you still verify after the
  fact, and how to roll this out without wrecking productivity — actionable
  errors, unambiguous provenance and policies, audited breakglass. From Building
  Secure and Reliable Systems, Ch. 14. Trigger: admission control, choke point,
  bypass, direct deploy, audit log, dry run, fail open, breakglass, emergency
  change, rollout of a policy, actionable error message.
---

# Enforcement, verification, and rollout

A check that can be walked around is a suggestion. A check that blocks the
on-call at 3 a.m. gets deleted. Both failure modes are avoidable.

## Rules

1. **Enforce at a choke point** — a point every deployment must pass through.
   Configure everything downstream to accept requests only from it, or an
   adversary simply talks to the downstream thing directly.
2. **The choke point makes the decision,** directly or via an RPC. A proxy in
   front works too, but only if the thing behind it refuses direct access.
3. **Verify after deployment as well, always.** Policies change and must be
   re-evaluated against what is already running; requests may have been allowed
   because the decision service was down (fail open); someone may have used
   breakglass; people need to dry-run a policy before enforcing it; and
   investigators need the record.
4. **Log enough to re-decide later.** The full request is usually necessary and
   sometimes insufficient — if evaluation needs other state, log that too, or
   post-hoc verification becomes a multi-source join you can't do.
5. **One step at a time.** Scripting builds, then provenance, then
   config-as-code. Coordinating everything at once risks an outage and buries
   your colleagues in new workflows.
6. **Actionable error messages or nothing.** "Does not meet policy" leaves the
   user floundering; say which rule failed, what the value was, and what it
   should have been. Design for this early — some policy languages are too
   flexible to explain themselves, and the chapter's authors abandoned one for
   exactly that reason.
7. **Keep provenance unambiguous.** Propagate it inline with the artifact rather
   than looking it up in a database by hash: identical artifacts (the empty file)
   collapse to one key, verification time grows with the number of records, and
   asynchronous uploads fail silently.
8. **One policy per deployment.** If two can apply, you have to answer whether
   both must pass — avoid the question. Global rules become a meta-policy over
   the individual ones.
9. **Ship a breakglass, alarm on it, audit it fast.** Emergencies need a bypass;
   an unaudited bypass is the attack. If breakglass events are frequent, they
   stop being distinguishable from an attack — that frequency is itself a bug.

## Project bindings

Repo-specific tools, paths, and commands for this skill live in the profile, not here: `<paths.profile>/skills.md`, section `deployment-enforcement` (`<kit>` is `paths.kit` in `config.yaml`).

## Source

[`reference.md`](reference.md) — "Deployment Choke Points", "Post-Deployment
Verification", and "Practical Advice", verbatim.
