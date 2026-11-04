---
name: verifiable-builds
description: >
  Make the build itself trustworthy: hermetic inputs, reproducible outputs,
  privilege separation between the orchestrator and user-defined build steps.
  From Building Secure and Reliable Systems, Ch. 14. Trigger: hermetic build,
  reproducible build, Cargo.lock, --locked, pinned toolchain, build sandbox,
  build server, signing key access, vendored dependency, cherry-pick a fix.
---

# Verifiable builds

A build is verifiable when the provenance it emits can be trusted. That trust
comes from what the builder cannot do, not from what it promises.

## Rules

1. **Three definitions, kept distinct.**
   - **Hermetic** — all inputs are specified up front, outside the build:
     sources, compilers, build tools, libraries, each pinned by exact version or
     hash.
   - **Reproducible** — the same commands on the same inputs produce bit-for-bit
     identical output. Almost always requires hermeticity.
   - **Verifiable** — the provenance of an artifact can be determined in a
     trustworthy way. Usually wants the other two but doesn't strictly require
     them.
2. **Hermeticity buys three concrete things:** you can analyse what went into a
   build (CVEs, licences, banned libraries); you get integrity of third-party
   imports; and you can cherry-pick a fix — patch, rebuild, ship, with no
   incidental behaviour change from a different toolchain. That last one is what
   makes emergency releases survivable.
3. **Reproducibility is a test for hermeticity.** A build that stops reproducing
   has usually acquired a hidden input. It also enables independent
   re-verification after an incident, and better build caching.
4. **Pick a verification architecture deliberately:** a trusted build service
   (build once, no reproducibility needed — Google's model); rebuild-it-yourself
   (doesn't scale — builds take minutes, deploy decisions take milliseconds);
   or a quorum of rebuilders (Debian's model).
5. **Write down the non-functional requirements** you actually want. E.g. one
   compromised workstation must not compromise provenance; tampering must be
   detectable; one build must not affect another, parallel or serial; provenance
   must not be able to lie about its source; non-admins must not be able to
   configure build steps that violate the list; source snapshots survive N
   months.
6. **Treat user-defined build steps as remote code execution by design.**
   Makefiles, `build.rs`, CI scripts — they run arbitrary code, and they can
   steal the signing key, forge provenance, alter machine state, or interfere
   with a parallel build.
7. **Separate privileges.** A trusted orchestrator sets up known-good state,
   fetches the declared inputs, starts the build, and signs the provenance
   afterwards. User-defined commands run in a sandbox with no access to the key
   or any privilege.
8. **Fetch dependencies only through the orchestrator, over authenticated
   channels.** An unauthenticated fetch is a man-in-the-middle away from being a
   supply chain attack.

## Project bindings

Repo-specific tools, paths, and commands for this skill live in the profile, not here: `<paths.profile>/skills.md`, section `verifiable-builds` (`<kit>` is `paths.kit` in `config.yaml`).

## Source

[`reference.md`](reference.md) — "Verifiable Builds", the "Hermetic,
Reproducible, or Verifiable?" sidebar, and "Implementing verifiable builds",
verbatim.
