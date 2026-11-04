# Reliability and security assessment

This file is the template for a **reliability and security assessment** of a
system. It is **not** a binding spec. Binding specs use
[`DESIGN_DOC.md`](DESIGN_DOC.md). Indexes use `paths.index_pattern`.

Copy the section shape into `<paths.reviews>/<system>-reliability.md`. Do not start from a
blank page. Do not paste this file into an assessment. If a section does not
apply, say so and why — do not delete the heading.

The sections below are unchanged.

---

## Scalability

How does your system scale? Consider both data size increase (if applicable) and traffic increase (if applicable).

Consider the current hardware situation: adding more resources might take much longer than you think, or might be too expensive for your project. What initial resources will you need? You should plan for high utilization, but be aware that using more resources than you need will block expansion of your service.

## Redundancy and reliability

Discuss how the system will handle local data loss and transient errors (e.g., temporary outages), and how each affects your system.

Which systems or components require data backup? How is the data backed up? How is it restored? What happens between the time data is lost and the time it’s restored?

In the case of a partial loss, can you keep serving? Can you restore only missing portions of your backups to your serving data store?

## Dependency considerations

What happens if your dependencies on other services are unavailable for a period of time?

Which services must be running in order for your application to start? Don’t forget subtle dependencies like resolving names using DNS or checking the local time.

Are you introducing any dependency cycles, such as blocking on a system that can’t run if your application isn’t already up? If you have doubts, discuss your use case with the team that owns the system you depend on.

## Data integrity

How will you find out about data corruption or loss in your data stores?

What sources of data loss are detected (user error, application bugs, storage platform bugs, site/replica disasters)?

How long will it take to notice each of these types of losses?

What is your plan to recover from each of these types of losses?

## SLA requirements

What mechanisms are in place for auditing and monitoring the service level guarantees of your application?

How can you guarantee the stated level of reliability?

## Security and privacy considerations

Our systems get attacked regularly. Think about potential attacks relevant for this design and describe the worst-case impact it would have, along with the countermeasures you have in place to prevent or mitigate each attack.

List any known vulnerabilities or potentially insecure dependencies.

If, for some reason, your application doesn’t have security or privacy considerations, explicitly state so and why.

Once your design document is finalized, file a quick security design review. The design review will help avoid systemic security issues that can delay or block your final security review.
