---
name: supply-chain-threat-model
description: >
  Name your adversaries, list the concrete ways they subvert build and deploy,
  map each threat to a mitigation and that mitigation's limits — including
  third-party dependencies. From Building Secure and Reliable Systems, Ch. 14.
  Trigger: threat model, insider risk, supply chain attack, dependency trust,
  third-party code, vendoring, mitigation table, what could go wrong.
---

# Software supply chain threat model

Hardening without a threat list is decoration. Write down who attacks you, how,
and what each control actually covers.

## Rules

1. **Three adversary classes.** Benign insiders who make mistakes; malicious
   insiders exceeding their role; external attackers using a compromised
   insider's account or machine. Treat the mistake and the attack the same —
   intent doesn't change the blast radius.
2. **Enumerate concrete threats, not categories.** The chapter's list is the
   template: unreviewed change merged; build from a locally modified tree;
   harmful config (debug flags in prod); modified binary deployed directly;
   ACLs widened to allow exfiltration; signing key stolen; old vulnerable
   version redeployed; CI configured to build from arbitrary repos; custom build
   script exfiltrating the key; backdoored compiler.
3. **Map each threat to a mitigation *and its limitations*.** Code review does
   not stop collusion or a multi-account compromise. Config-as-code doesn't
   cover config that can't be code. Breakglass can be abused. The gaps are the
   findings.
4. **Threats with no mitigation, or with weak ones, are the backlog.** Decide
   explicitly whether each is worth addressing for your organization.
5. **Third-party code gets the rigor you can justify.** Full trust in the
   maintainers, their review process, and their VCS means importing is
   straightforward; less trust means reviewing the code or the patches you pull
   yourself, potentially against an internal copy.
6. **Regardless of trust, monitor dependencies for vulnerability reports and
   patch quickly.**

## Project bindings

Repo-specific tools, paths, and commands for this skill live in the profile, not here: `<paths.profile>/skills.md`, section `supply-chain-threat-model` (`<kit>` is `paths.kit` in `config.yaml`).

## Source

[`reference.md`](reference.md) — "Threat Model", "Securing Against the Threat
Model" (Table 14-1, third-party code), and the revisited mapping (Table 14-2),
verbatim.
