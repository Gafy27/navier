# Requirements (this project)

## Objective

Run every Navier agent turn as a DBOS workflow on the Postgres Navier already
uses, with the least machinery around it, without losing a guarantee the
Temporal runner gives today; keep Temporal compiling behind a runner seam;
replace the gRPC authz client with authz-engine.

## Owner decisions (fixed; not gates)

1. DBOS is the only maintained runner. Temporal stays as a **frozen adapter**:
   it keeps compiling and passing its own tests, nothing more.
2. No Vercel AI SDK in the runner. `llm/` and its `ModelAdapter` stay unchanged
   (an AI SDK adapter could be added later behind `ModelAdapter`).
3. Keep the Postgres `stream_delta` table + LISTEN/NOTIFY + SSE hub.
4. The DBOS worker is a long-lived process outside Vercel; the API may use the
   DBOS client (or the `dbos.*` SQL functions) only.
5. Keep current tables; in-flight Temporal turns drain on Temporal, new turns
   start on DBOS.
6. Full factory depth: architecture, program, anexo per unit; up to three
   independent review rounds per spec; after three not-ready rounds the spec
   is BINDING with unresolved findings recorded (owner instruction).
7. Minimum: every piece of machinery around the turn workflow gets a
   keep / replace-by-DBOS / delete / simplify verdict (P0.4).
8. authz-engine replaces `identity/authz*`, the `cosmos.authz.v1` gRPC client
   and the code that depends on it; the old client lives behind the authz seam
   only until the authz cutover. Open-source Navier keeps authz pluggable with
   authz-engine as the default.

## Laws (summary; owners in parentheses)

- One agent message = one turn workflow id, derived from its ids (P2.1).
- Workflow inputs, step outputs, messages and events hold ids and small enums
  only: no text, request context, arguments, outputs or credentials (P2.1, P7.2).
- Every runtime write stays a guarded append (`appendIfNewest`, CAS on newest
  status) so a re-executed step writes nothing new (P2.5).
- A turn start commits with the rows that need it (P2.1, P3.1).
- Fail closed on every authorization error (P4.3).

## Phases

0 research and map · 1 runner seam · 2 DBOS turn workflow · 3 simplification ·
4 authz-engine · 5 migration and cutover · 6 operations · 7 hardening and cleanup.
