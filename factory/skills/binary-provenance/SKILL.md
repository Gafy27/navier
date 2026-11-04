---
name: binary-provenance
description: >
  Record how each artifact was built (inputs, command, environment, signed
  outputs), then write deployment policies against that record instead of
  trusting a bare signature. From Building Secure and Reliable Systems, Ch. 14.
  Trigger: provenance, SLSA, in-toto, artifact signing, code signing, image
  digest, deployment policy, admission control, what built this binary.
---

# Binary provenance and provenance-based policies

A signature says someone vouched. Provenance says what actually went in — and
that is what a policy can check.

## Rules

1. **Every build emits provenance:** the inputs, the transformation, and who
   performed it. Without it, "which source produced this binary?" becomes
   reverse engineering.
2. **Required fields: authenticity and outputs.** Authenticity is normally a
   signature over the rest; outputs are identified by content hash.
3. **Strongly recommended fields:** sources (the main input, e.g. a Git commit
   in a named repo), dependencies (libraries, build tools, compilers — anything
   that can change the result), the build command (structured, so it can be
   analysed), the environment, input metadata, debug info, and a
   version/timestamp so the format can change and old builds can be invalidated.
4. **Identify inputs by both name and version** — a URI plus a cryptographic
   hash. The name proves origin; the hash proves what you got.
5. **Anything the build system doesn't check must be checked downstream.** If a
   user can pass arbitrary compiler flags or choose the compiler, the verifier
   has to validate those. More validation inside the build is better.
6. **Code signing is worth exactly what the key protection is worth.** Accepting
   "any valid signature" is close to no control. List accepted signers, lock
   down the keys, harden the signing environment, and treat obtaining a
   signature as a deployment in its own right.
7. **Prefer policies over per-environment keys.** With provenance, one signing
   key per build step plus an explicit policy per environment beats a key per
   source repo — the rules live in one readable place instead of in CI wiring.
8. **Useful policy rules:** source was reviewed and submitted; it came from an
   approved repository/target; the build ran on the official pipeline; tests
   passed; the artifact is allowed in *this* environment (no test binaries in
   prod); the version is recent enough; a recent scan found no known vulns.
9. **Policy evaluation is three checks, never fewer:** the provenance is
   authentic; it applies to *this* artifact (hash match); and it satisfies the
   rules. A bare signature check collapses all three into one — which is why it
   is weak.

## Project bindings

Repo-specific tools, paths, and commands for this skill live in the profile, not here: `<paths.profile>/skills.md`, section `binary-provenance` (`<kit>` is `paths.kit` in `config.yaml`).

## Source

[`reference.md`](reference.md) — "Advanced Mitigation Strategies", "Binary
Provenance", "Code Signing", and "Provenance-Based Deployment Policies",
verbatim.
