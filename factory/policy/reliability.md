# Reliability and security assessments

If the user asks to **assess reliability or security** of a system (scale, redundancy,
dependencies, data integrity, SLA, privacy; not a binding design):

1. Read the skill `reliability-security`. It owns the structure.
2. Copy the section shape from `paths.reliability_template`; do not start from a
   blank page.
3. Write `<paths.reviews>/<system>-reliability.md`, where `{n}` is the phase whose
   design owns the system. Design reviews use `vocabulary.review_file`, so pick a
   different name.

Do not start from a blank page. Do not fold an assessment into a design. It is not a
binding spec. Binding designs stay on [`design.md`](design.md); writing secure code stays
on [`implementation.md`](implementation.md).
