---
name: safe-types-untrusted-input
description: >
  Make injection impossible by construction: distinct types for trusted vs
  untrusted strings (TrustedSqlString, SafeHtml), bound parameters, and the
  OWASP top-10 framework mitigations. From Building Secure and Reliable Systems,
  Ch. 12. Trigger: SQL string building, DDL rendering, query, injection, XSS,
  escaping, sanitizing, user input, deserialization, sensitive data in logs.
---

# Untrusted input gets its own type

An injection bug is a type error the compiler was never asked to catch. Give
developer-controlled strings and externally-controlled strings different types,
and the mixing stops compiling.

## Rules

1. **Bound parameters where the protocol has them.** Never concatenate a value
   into a query.
2. **Where it has none (DDL, HTML), use a type.** The query/markup type is built
   only from source literals plus explicitly escaped values; its constructors are
   the trusted codebase.
3. **A guideline is not a control.** "Always use prepared statements" needs every
   developer educated and every review perfect. A type needs neither.
4. **Escaping is context-dependent.** HTML element text, attribute, URL, and
   script contexts have different rules; one `escape()` for all of them is wrong.
   Distinct types per context (`SafeHtml`, `SafeUrl`) encode that.
5. **Leave one reviewed escape hatch.** A separate, obviously named `unsafe`
   constructor, used rarely, reviewed by a security-minded person. Google runs
   this with one part-time rotating reviewer for thousands of developers.
6. **Repeated exemptions are a feature request** — support the use case in the
   safe library instead.
7. **Sensitive values get their own type too** — restrict its serialization so it
   cannot leak into logs or errors.
8. **Parse untrusted structured data with libraries built for it** (Protocol
   Buffers over ad-hoc deserialization); don't enable risky parser features.

## Project bindings

Repo-specific tools, paths, and commands for this skill live in the profile, not here: `<paths.profile>/skills.md`, section `safe-types-untrusted-input` (`<kit>` is `paths.kit` in `config.yaml`).

## Source

[`reference.md`](reference.md) — OWASP Table 12-1, `TrustedSqlString`, and
`SafeHtml`, verbatim.
