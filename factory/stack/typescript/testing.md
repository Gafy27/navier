# Testing (TypeScript)

Kit testing method: `policy/testing.md`. Fixtures and “never mock”: adopting
repo `<paths.profile>/testing.md`.

- Runner: `node:test`. Gates are `commands.*`.
- **Default: unit.** Integration only where the behavior lives in an external
  system or the wire. A local fake of a service only where a design names it.
- A test never calls a live third-party SaaS. It builds its own fixtures.
- Contract tests import only a unit's public entry point.
- Do not add a fuzz or sanitizer pipeline the design did not name.
