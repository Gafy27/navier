---
name: deployment-best-practices
description: >
  The five controls that cover most supply chain threats: mandatory code review,
  automation for every build/test/deploy step, verifying artifacts rather than
  people, configuration as code, and never checking in secrets. From Building
  Secure and Reliable Systems, Ch. 14. Trigger: code review policy, CI/CD
  automation, manual deploy, config as code, env file, secrets, .env, signing,
  who can deploy.
---

# Deployment best practices

Five controls. Most organizations get most of their protection from these,
before any advanced machinery.

## Rules

1. **Code review is mandatory or it is nothing.** An adversary who can opt out
   is not deterred. Reviews must be deep enough to catch problems — the reviewer
   understands the change and its implications, or asks. Otherwise it becomes
   rubber-stamping. Review is multi-party authorization applied to source.
2. **Review covers configuration too.** Config changes go through the same
   check-in, review, and test path as code.
3. **Automate every build, test, and deploy step.** At minimum, script them so a
   human and a machine run the same steps. Manual builds on a workstation invite
   wrong versions, unreviewed code, and locally modified binaries.
4. **Review changes to the automation itself,** and lock the automation down so
   an admin cannot quietly change behaviour by editing the pipeline or SSH-ing
   into the machine.
5. **Verify artifacts, not just people.** Authorization still matters for least
   privilege, but the environment must check *what* is being deployed — proof
   that each automated step ran — and humans must not be able to bypass it
   without a compensating, audited control.
6. **Never check secrets into version control or embed them in source.**
   Store them in a secret or key management system, grant access to services and
   not to humans, and issue separate credentials when a human genuinely needs
   one.
7. **These are defense in depth.** Review has known limits; it pairs with the
   testing of Ch. 13 and the by-construction safety of Ch. 12.

## Project bindings

Repo-specific tools, paths, and commands for this skill live in the profile, not here: `<paths.profile>/skills.md`, section `deployment-best-practices` (`<kit>` is `paths.kit` in `config.yaml`).

## Source

[`reference.md`](reference.md) — "Best Practices": code review, automation,
verify artifacts, configuration as code, secrets, verbatim.
