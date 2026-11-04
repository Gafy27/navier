---
name: deploying-code
description: >
  Router for the five "Deploying Code" skills extracted from Building Secure and
  Reliable Systems (Google/O'Reilly), Chapter 14, plus the chapter's supply
  chain vocabulary. Load when you want the chapter's overall argument or don't
  yet know which sub-skill applies. Trigger: deploy, deployment, release,
  software supply chain, CI/CD, build pipeline, rollout, artifact, SRS book.
---

# Deploying code (chapter router)

Chapter 14 of *Building Secure and Reliable Systems* in five loadable skills.
Load the one that matches the task; do not load all five.

## The chapter's argument in four lines

1. Is the code running in production the code you think it is? Controls on
   source, build, and test are worthless if someone can deploy around them.
2. Verify **what** is being deployed, not only **who** deployed it.
3. Every step in the supply chain should be able to prove it ran — that proof
   is binary provenance, and policies are written against it.
4. Configuration is code, and secrets are neither.

## Vocabulary the chapter uses

- **Software supply chain** — write → build → test → deploy, including VCS, CI,
  and CD.
- **Build** — any transformation of input artifacts into output artifacts.
  A **test** is a build whose output is pass/fail.
- **Deployment** — any assignment of an artifact to an environment: pushing a
  binary, updating config, or publishing a package.

## Which skill

| Task at hand | Load |
|--------------|------|
| Naming adversaries, mapping threats to mitigations, third-party deps | [`supply-chain-threat-model`](../supply-chain-threat-model/SKILL.md) |
| Review policy, automation, config-as-code, secret handling | [`deployment-best-practices`](../deployment-best-practices/SKILL.md) |
| Recording how an artifact was built; signing; policies over provenance | [`binary-provenance`](../binary-provenance/SKILL.md) |
| Hermetic / reproducible / verifiable builds, locking down the builder | [`verifiable-builds`](../verifiable-builds/SKILL.md) |
| Where the check runs, post-deploy verification, breakglass, rollout | [`deployment-enforcement`](../deployment-enforcement/SKILL.md) |

## Relation to the other skills

This router sits beside `secure-code-writing` and `testing-code`: those cover writing and testing code, this one covers getting it to production. Project-specific tools and CI are in `<paths.profile>/skills.md`.

## Project bindings

Repo-specific tools, paths, and commands for this skill live in the profile, not here: `<paths.profile>/skills.md`, section `deploying-code` (`<kit>` is `paths.kit` in `config.yaml`).

## Source

[`reference.md`](reference.md) — chapter introduction, "Concepts and
Terminology", and conclusion, verbatim.
