---
name: hardened-frameworks
description: >
  Put security and reliability in shared frameworks and libraries, not in every
  service. Interceptor/stage layout for request handling, hard vs soft
  dependencies, retries with exponential backoff. From Building Secure and
  Reliable Systems, Ch. 12. Trigger: new module, new job kind, RPC or worker
  seam, logging, authentication, authorization, rate limiting, retry, backoff,
  cascading failure, boilerplate repeated per service.
---

# Frameworks enforce what review cannot

Reviewers cannot hold global invariants in their heads — they would need to know
every transitive caller. Move the invariant into a framework or library that
every service uses, then fix it in one place.

## Rules

1. **One hardened implementation per cross-cutting concern.** Authentication,
   authorization, logging, encryption, rate limiting, load balancing, retries.
   Not one per service.
2. **The framework owns the guarantee; the caller customises the policy.** The
   caller says *which* role may call; it never verifies the credential itself.
3. **Reuse before you build.** Especially crypto. Evaluate the security posture
   and maintenance activity of anything you adopt, and keep dependencies current.
4. **Stages, not tangles.** Each concern gets a before/after stage around the
   real work. An error in a before stage skips the work but still runs the after
   stages already entered, in reverse order — so a denied request is still logged.
5. **Shared context object.** Validated caller info flows forward through
   context; later stages read it rather than re-deriving it.
6. **Deadlines belong to the framework.** If the request cannot finish in time,
   cancel it and tell the client early — that saves resources and is more reliable.
7. **Declare dependencies hard or soft.** On a hard dependency going away, report
   unavailable and let traffic move; do not serve broken.
8. **Retries are framework-provided and backed off exponentially.** Hand-rolled
   per-call retry loops are how cascading failure starts.

## Project bindings

Repo-specific tools, paths, and commands for this skill live in the profile, not here: `<paths.profile>/skills.md`, section `hardened-frameworks` (`<kit>` is `paths.kit` in `config.yaml`).

## Source

[`reference.md`](reference.md) — "Frameworks to Enforce Security and Reliability"
and the RPC backend example with Go interceptor code, verbatim.
