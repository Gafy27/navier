# P1.1 Principal — tickets and session prompts

Companion to [`PHASE1_P1.1_PRINCIPAL.md`](./PHASE1_P1.1_PRINCIPAL.md), not a
replacement. The spec owns the law, the decisions, and the trade-offs. This
file owns the ticket rows, the sequence, the file fences, and **one
paste-ready prompt per session**.

Copy **one SESSION block** into a **new agent session** with this repo as the
working directory. Do not paste two tickets into one chat. Do not resume the
previous ticket's chat. No code lands with this document.

To run the whole anexo without pasting: a **new** chat with
`run tickets impl/designs/PHASE1_P1.1_PRINCIPAL_TICKETS.md` (skill
`ticket-orchestrator`). That parent still launches one fresh subagent per
SESSION block.

If the spec is ambiguous or you believe it is wrong, **stop and report** — do
not resolve it yourself and do not invent a variant.

Each session **must run** the repo-wide gates and the tests for the phase
folders it may edit, plus any extra rows its Green when names. It must **not**
run another phase's tests. The full `npm test` runs on the **last ticket
only**.

**The last ticket is always simplify.** Ticket 4 reads the code this slice
landed and deletes complexity. It uses `complexity-remover`
and `.claude/skills/typescript-magician/SKILL.md`.

- It adds no feature, changes no spec, and widens no public API.
- It does **not** fix failures from tickets 1–3. If a gate fails for another
  reason, stop and report the owning ticket.
- Do not loosen asserts or delete tests.

## Prerequisite

- Phase 0 is `done` in [`README.md`](./README.md) (`src/core/index.ts` v1.0).
- The spec's gates are answered (D3, D4, D5; decision log Q28–Q30).
- The spec is `BINDING`.

## Sequence

```
1 -> 2 -> 3 -> 4
```

Strictly serial. Tickets 1 and 2 edit `src/identity/index.ts` and
`test/contract/identity.test.ts`. Ticket 3 edits neither.

## Tickets

| # | Ticket | Files it may edit | Green when |
|---|--------|-------------------|------------|
| 1 | Values: `PrincipalId` brand, `PrincipalKind`, `Principal`, `parsePrincipalId`, `AuthFailure`, `AuthError`, private `authError`, and `brandPrincipalId` exported from `principal.ts` only (D1, D2, D3) | `src/identity/principal.ts`, `src/identity/principal.test.ts`, `src/identity/auth-error.ts`, `src/identity/auth-error.test.ts`, `src/identity/index.ts`, `test/contract/identity.test.ts` | Phase fence. V1–V4, V10, V11, V12 hold |
| 2 | Config: `IdentityConfigSchema`, `IdentityConfig`, private `resolveSettings` and `Settings`; two new rows in the root README config table (D4, D5) | `src/identity/config.ts`, `src/identity/config.test.ts`, `src/identity/settings.ts`, `src/identity/settings.test.ts`, `src/identity/index.ts`, `test/contract/identity.test.ts`, `README.md` (configuration table only) | Phase fence. V5–V7 hold |
| 3 | Claim rules: private `principalFromClaims` (D6) | `src/identity/claims.ts`, `src/identity/claims.test.ts` | Phase fence. V8, V9 hold |
| 4 | Simplify the landed slice (complexity-remover). No new behavior | Only files tickets 1–3 edited | Repo gates, phase tests, then `npm test`. V1, V10, V11 print nothing |

## Validation contract

Written in the **design session, before any code**. Each row names a way to
break one spec law or D. When the review level is `full`,
Ticket tests exercise validation rows after green; at `full`, `code-reviewer` reviews the diff on a
snapshot of the tree, never on the working tree. `probe` rows may
import private modules of `src/identity/`; contract rows in the real tree may
not.

| V# | Attacks | Kind | Attack | Observable failure | Owner |
|----|---------|------|--------|--------------------|-------|
| V1 | D1 | `cmd` | `rg -l "from [\"']jose" src/identity --glob '!src/identity/verifier.ts'` | Any match. A ban: it passes when it prints nothing | 1 |
| V2 | D2, G1 | `probe` | With namespace `corp`: `parsePrincipalId` on `user:corp~abc`, `user:corp~a~b`, then on `user:other~abc`, `user:corporate~abc`, `corp~abc`, `group:corp~abc`, `user:corp~`, `user:corp~a#b`, `user:corp~a:b`, `user:corp~a b`, `user:corp~a\tb`, `user:Corp~abc`, `` | The first two are not `ok`, any other is `ok`, or an error's message is not exactly `invalid principal id` | 1 |
| V3 | G1, D2 | `probe` | Scratch `src/identity/v3-scratch.ts` (inside `tsconfig.json` `include`) that imports `PrincipalId` and `Principal` from `./index.ts` and holds exactly two lines under test: `const p: PrincipalId = 'user:corp~abc';` and a `Principal` literal with `id: 'user:corp~abc'`. Run `tsc --noEmit` | `tsc` exits 0, or it reports any error other than one assignability error on each of those two lines | 1 |
| V4 | D3, G2 | `probe` | Build `authError(r)` for every value of `AuthFailure` | The set of values is not exactly the ten in the spec; any code is not `unauthenticated`; the messages differ or are not `invalid or missing credentials`; any result has a `cause` key | 1 |
| V5 | D4 | `probe` | `loadConfig(IdentityConfigSchema, env)` with a valid env whose `IDP_ALGORITHMS` is `RS256,RS384,RS512,PS256,PS384,PS512,ES256,ES384,ES512,EdDSA`. Then `IDP_ALGORITHMS` set to `HS256`, `none`, `RS256,HS256`, `rs256`, `RS256, ES256`, `RS256,`, `Ed25519` | The full-list env is not `ok`, `RS256,ES256` is not `ok`, or any bad value is not `invalid_argument` naming `IDP_ALGORITHMS` | 2 |
| V6 | D4 | `probe` | Valid env minus `IDP_JWKS_TIMEOUT_MS` and `IDP_CLOCK_TOLERANCE_S`. Then `IDP_CLOCK_TOLERANCE_S` set to `0`, `300`, `301`; `IDP_JWKS_TIMEOUT_MS: '0'`; `PRINCIPAL_NAMESPACE` set to `Corp`, `a~b`, `a:b`, `SECRET-zz9`. Serialize each result | Either missing variable is not tagged `(missing)`; tolerance `0` or `300` is not `ok`; tolerance `301`, timeout `0`, or a bad namespace is `ok`; or any serialized result contains `zz9` | 2 |
| V7 | D5, G4 | `probe` | `resolveSettings` with: both service modes set; neither; `requireTls: true` and `IDP_JWKS_URI: 'http://secret-host.example/jwks'`; `requireTls: false` and the same URI; `requireTls: true` and `https://idp.test/jwks`; `IDP_JWKS_URI: 'http://[secret-zz5'` (matches the schema pattern, `new URL` throws); `SERVICE_SUBJECT_SUFFIX` set to `@a:b`, `@a#b`, `@a b` (claim mode unset); and one call with both service variables set, `requireTls: true`, and the `http://secret-host` URI | Both/neither are not `invalid_argument` naming both variables; the `http:` TLS case is `ok`, or its message lacks `IDP_JWKS_URI`; the plaintext and `https:` TLS cases are not `ok`; the throwing URI is `ok` or not tagged `IDP_JWKS_URI (invalid)`; any bad suffix is `ok` or not tagged `SERVICE_SUBJECT_SUFFIX (invalid)`; the combined call is not one message naming `IDP_JWKS_URI`, `SERVICE_SUBJECT_CLAIM`, and `SERVICE_SUBJECT_SUFFIX` once each; any message contains `secret-host` or `zz5` | 2 |
| V8 | D6, G3 | `probe` | Claim mode `gty=client-credentials`, namespace `corp`. Claims: no `sub`; `sub` of `5`, `''`, `a#b`, `a:b`, `a b`, `a\nb`; `{ sub: 'x', gty: 'client-credentials' }`; `{ sub: 'x@clients' }`; `{ sub: 'x', gty: ['client-credentials'] }`; `{ sub: 'x', gty: 'other' }`; `{ sub: 'x', gty: 'Client-Credentials' }`. Suffix mode `@clients`: `{ sub: 'x@clients' }`, `{ sub: '@clients' }`, `{ sub: 'x', gty: 'client-credentials' }` | Missing `sub` is not `malformed`; any bad `sub` is not `bad_subject`; the kinds are not, in order, `service`, `human`, `human`, `human`, `human`, `service`, `human`, `human` | 3 |
| V9 | D2, D6 | `probe` | For `sub` `a~b|c`, take the id from `principalFromClaims` and pass it to `parsePrincipalId(id, 'corp')` | The id is not `user:corp~a~b|c`, or the parse is not `ok` | 3 |
| V10 | G5 | `cmd` | `rg -i "auth0\|okta\|entra\|azure\|keycloak\|cognito\|google" src/identity` | Any match | 1 |
| V11 | brief (no logs) | `cmd` | `rg -n "console\.\|logger\|\.log\(" src/identity --glob '!*.test.ts'` | Any match | 1 |
| V12 | D3, G2 | `probe` | Scratch `src/identity/v12-scratch.ts` (inside `include`) that imports `AuthError` from `./index.ts` and declares one `AuthError` object literal with `code`, `message`, `reason`, and `cause: new Error()`. Run `tsc --noEmit` | `tsc` exits 0, or it reports any error other than one on the `cause` property | 1 |

**Not attackable:** none.

## Progress

Maintained **only by `ticket-orchestrator`**, through `scripts/harness/record.sh`.
Nobody else edits this block, and it is never pasted into a prompt.
Implementers read it from disk: the Anchor, plus their own row.

| # | State | Attempts | Verifier | Validator | Handoff |
|---|-------|----------|----------|-----------|---------|
| 1 | PENDING | 0 | — | — | — |
| 2 | PENDING | 0 | — | — | — |
| 3 | PENDING | 0 | — | — | — |
| 4 | PENDING | 0 | — | — | — |

Handoffs are stored at
`.claude/harness/runs/PHASE1_P1.1_PRINCIPAL_TICKETS/ticket-<N>.md`.

### Anchor

- **Intent:** <!-- PHASE1_P1.1_PRINCIPAL: identity values, config, claim rules -->
- **Files touched so far:** <!-- cumulative -->
- **Decisions:** <!-- silent choices a human `continue`d, with ticket # -->
- **Open issues → owner / Next:** <!-- issue → ticket or spec; next ticket -->

## Fences every ticket runs

1. Repo-wide gates: `npm run typecheck`, `npm run lint`,
   `npm run format:check`, `npm run deps:check`.
2. `node --test 'src/identity/**/*.test.ts' test/contract/identity.test.ts`.
3. Extra rows the ticket's Green when names. No ticket here edits `openfga/`
   or `proto/`.

Do **not** run the full `npm test` except on ticket 4. Do **not** run another
phase's tests.

```
npm run typecheck && npm run lint && npm run format:check && npm run deps:check
node --test 'src/identity/**/*.test.ts' test/contract/identity.test.ts
```

A fence written to fail (an `rg` ban that must find nothing) passes when it
reports nothing. Do not weaken the pattern.

## Phase close (ticket 4 only)

After the simplify diff, run the repo gates, the phase tests, then:

```
docker compose up -d openfga
npm test
```

No P1.1 test needs OpenFGA. If those fail and the failure is not from the
simplify diff, stop and report. Phase 1 as a whole closes at P1.2, so do not
edit the status table here.

## What no ticket may do

- Install or import `jose`, fetch anything, or parse an `Authorization`
  header. That is P1.2.
- Export `authError`, `brandPrincipalId`, `resolveSettings`, `Settings`, or
  `principalFromClaims` from `index.ts`.
- Put a `cause` on an `AuthError`, or an input, claim, or config value in any
  message (D2, D3, D5).
- Read `REQUIRE_TLS` or `process.env`. `requireTls` is an argument (D5).
- Give any config property a default, or add a variable the spec does not
  name.
- Log, or import a logger.
- Name a vendor anywhere under `src/identity/`, including tests (V10). Tests
  use neutral values such as `https://idp.test/`, `corp`, `@clients`.
- Use `any`, `enum`, namespaces, parameter properties, or a cast outside
  `brandPrincipalId`.
- Edit Phase 0 files, `phase-1.md`, the spec, or this anexo outside Progress.

---

## SESSION 1 — Ticket 1: principal values and AuthError

```
You are implementing an already-locked spec. This is not a redesign.

Spec: impl/designs/PHASE1_P1.1_PRINCIPAL.md (BINDING). This session is ticket 1
only. Stop when it is green. Do not start later tickets. Do not edit the design.
Do not touch folders other than src/identity/ and test/contract/.

## Read before writing any TypeScript, in this order

1. CLAUDE.md, docs/typescript-standards.md, policy/phase-composition.md,
   policy/tickets.md, policy/testing.md. Non-negotiable.
2. .claude/skills/typescript-magician/SKILL.md (brands, const objects,
   narrowing). .claude/skills/node/SKILL.md for type stripping and imports.
   .claude/skills/unit-testing/SKILL.md.
3. impl/designs/PHASE1_P1.1_PRINCIPAL.md — Context, "APIs" (normative), D1,
   D2, D3, G1, G2, G5.
3a. This anexo's "## Progress" block (Anchor, your row). Read the prior handoff
    if Attempts >= 1.
4. src/core/index.ts, src/core/errors.ts, src/core/result.ts (the Result and
   AppError you build on). test/contract/core.test.ts for contract-test style.

## This ticket lands

- src/identity/principal.ts: PrincipalId brand (declare const unique symbol),
  PrincipalKind const object + union, Principal, parsePrincipalId(input,
  namespace) per D2, and brandPrincipalId holding the only cast with the
  eslint-disable line and its reason. brandPrincipalId is exported from
  principal.ts (ticket 3 calls it) and not from index.ts. This is the stated
  exception to standards §3 (spec D2).
- src/identity/auth-error.ts: AuthFailure (the ten reasons, D3), AuthError as
  its own interface with exactly code ('unauthenticated'), message, and
  reason. It does not extend AppError, so it has no cause property (D3).
  Private authError(reason) with the fixed message.
- src/identity/index.ts re-exports exactly the P1.1 public names that exist
  after this ticket, with TSDoc on each (contract, error codes, side effects).
- Unit tests for D2 and D3 next to the code. test/contract/identity.test.ts
  pins parsePrincipalId and the AuthFailure values through index.ts only.

## Rules specific to this ticket

- parsePrincipalId never echoes its input. Message is exactly
  "invalid principal id".
- Whitespace is /\s/u. Do not widen the subject ban beyond :, #, whitespace.
- No config, no claims code. Those are tickets 2 and 3.

## Green when

You must run these before reporting green. Do not skip them. Do not
substitute the full suite.

npm run typecheck && npm run lint && npm run format:check && npm run deps:check
node --test 'src/identity/**/*.test.ts' test/contract/identity.test.ts
rg -l "from [\"']jose" src/identity --glob '!src/identity/verifier.ts'      # prints nothing
rg -i "auth0|okta|entra|azure|keycloak|cognito|google" src/identity         # prints nothing
rg -n "console\.|logger|\.log\(" src/identity --glob '!*.test.ts'           # prints nothing
Do not run npm test. Do not run tests for phases this ticket does not name.

## Report

End with these six headings, in this order (a Stop hook rejects a Report without them):
### Done
### Not done
### Commands            (each command -> exit code)
### Choices the spec was silent on   (or "none")
### Discovered issues   (each -> owner: ticket #, spec, or pre-existing)
### Files touched
```

---

## SESSION 2 — Ticket 2: IdentityConfigSchema and resolveSettings

```
You are implementing an already-locked spec. This is not a redesign.

Spec: impl/designs/PHASE1_P1.1_PRINCIPAL.md (BINDING). This session is ticket 2
only. Stop when it is green. Do not start later tickets. Do not edit the design.
Do not touch folders other than src/identity/ and test/contract/, plus the
configuration table in the root README.md.

## Read before writing any TypeScript, in this order

1. CLAUDE.md, docs/typescript-standards.md, policy/phase-composition.md,
   policy/tickets.md, policy/testing.md. Non-negotiable.
2. .claude/skills/typescript-magician/SKILL.md (discriminated unions).
   .claude/skills/unit-testing/SKILL.md.
3. impl/designs/PHASE1_P1.1_PRINCIPAL.md — Context, "APIs", D4, D5, G4.
   impl/designs/PHASE0_P0.1_FOUNDATION.md D2 and D3 (how loadConfig reports
   names, empty means unset, no defaults).
3a. This anexo's "## Progress" block (Anchor, your row). Read the prior handoff
    if Attempts >= 1.
4. src/core/config.ts (loadConfig, CoreConfigSchema as the style to follow),
   src/identity/index.ts and auth-error.ts from ticket 1, README.md
   "Configuration" table.

## This ticket lands

- src/identity/config.ts: IdentityConfigSchema exactly per the D4 table
  (typebox 1.x, patterns, no defaults) and IdentityConfig = Static<...>.
- src/identity/settings.ts: private Settings, ServiceMode, and
  resolveSettings(config, requireTls) per D5: every failing condition in one
  message, format "invalid configuration: A (tag), B (tag)", names sorted,
  each once, no values, no cause. That includes the suffix ban (:, #,
  /\s/u → SERVICE_SUBJECT_SUFFIX (invalid)) and a URI that new URL rejects.
  On success: jwksUri as URL, algorithms split on ",",
  serviceMode as the discriminated union, the two timing numbers.
- index.ts re-exports IdentityConfigSchema and IdentityConfig with TSDoc.
- README.md: add rows for IDP_JWKS_TIMEOUT_MS (yes; JWKS fetch timeout and
  readiness probe budget; example 2000) and IDP_CLOCK_TOLERANCE_S (yes;
  seconds of skew on exp and nbf, 0–300; example 30) after IDP_ALGORITHMS.
  If an existing IDP_* or PRINCIPAL_NAMESPACE row contradicts D4, stop and
  report; do not edit it.
- Unit tests for the schema through core's loadConfig and for every D5 row.
  Contract rows for the schema in test/contract/identity.test.ts.

## Rules specific to this ticket

- Do not change src/core/. Cross-field rules stay out of loadConfig (D5).
- Do not read REQUIRE_TLS. requireTls is a boolean argument.
- No vendor names in tests: use https://idp.test/ and similar.

## Green when

You must run these before reporting green. Do not skip them. Do not
substitute the full suite.

npm run typecheck && npm run lint && npm run format:check && npm run deps:check
node --test 'src/identity/**/*.test.ts' test/contract/identity.test.ts
rg -i "auth0|okta|entra|azure|keycloak|cognito|google" src/identity         # prints nothing
Do not run npm test. Do not run tests for phases this ticket does not name.

## Report

End with these six headings, in this order (a Stop hook rejects a Report without them):
### Done
### Not done
### Commands            (each command -> exit code)
### Choices the spec was silent on   (or "none")
### Discovered issues   (each -> owner: ticket #, spec, or pre-existing)
### Files touched
```

---

## SESSION 3 — Ticket 3: principalFromClaims

```
You are implementing an already-locked spec. This is not a redesign.

Spec: impl/designs/PHASE1_P1.1_PRINCIPAL.md (BINDING). This session is ticket 3
only. Stop when it is green. Do not start later tickets. Do not edit the design.
Do not touch files other than src/identity/claims.ts and its test.

## Read before writing any TypeScript, in this order

1. CLAUDE.md, docs/typescript-standards.md, policy/phase-composition.md,
   policy/tickets.md, policy/testing.md. Non-negotiable.
2. .claude/skills/typescript-magician/SKILL.md (narrowing unknown).
   .claude/skills/safe-types-untrusted-input/SKILL.md. .claude/skills/unit-testing/SKILL.md.
3. impl/designs/PHASE1_P1.1_PRINCIPAL.md — "APIs", D2, D6, G3.
3a. This anexo's "## Progress" block (Anchor, your row). Read the prior handoff
    if Attempts >= 1.
4. src/identity/principal.ts, auth-error.ts, settings.ts from tickets 1–2.

## This ticket lands

- src/identity/claims.ts: private principalFromClaims(settings, claims) per
  D6, steps 1–4 in that order. Narrow from unknown; no cast except through
  brandPrincipalId. Exhaustive switch on serviceMode.kind.
- src/identity/claims.test.ts covering every D6 row, both modes, and the
  round-trip through parsePrincipalId.

## Rules specific to this ticket

- Claim mode compares claims[claim] === value as strings. No coercion, no
  array membership, no dotted paths.
- Suffix mode looks at sub only.
- Not exported from index.ts. P1.2 imports it from claims.ts.

## Green when

You must run these before reporting green. Do not skip them. Do not
substitute the full suite.

npm run typecheck && npm run lint && npm run format:check && npm run deps:check
node --test 'src/identity/**/*.test.ts' test/contract/identity.test.ts
Do not run npm test. Do not run tests for phases this ticket does not name.

## Report

End with these six headings, in this order (a Stop hook rejects a Report without them):
### Done
### Not done
### Commands            (each command -> exit code)
### Choices the spec was silent on   (or "none")
### Discovered issues   (each -> owner: ticket #, spec, or pre-existing)
### Files touched
```

---

## SESSION 4 — Ticket 4: simplify landed code

```
You are implementing an already-locked spec. This is not a redesign.

Spec: impl/designs/PHASE1_P1.1_PRINCIPAL.md (BINDING). This session is ticket 4
only — the mandatory simplify pass. Stop when it is green. Do not start other
tickets. Do not edit the design. Do not touch phase folders this ticket does
not name. Do not add features, types, or public API.

The earlier tickets already landed the slice. Your job is to look at that
code and make it smaller and easier to read. Delete lines. Flatten
layers that exist only once. Drop names that do not earn their keep.
Behavior and tests stay the same.

## Read before writing any TypeScript, in this order

1. CLAUDE.md (repo root) — Simplicity First and Surgical Changes.
   Non-negotiable. No features beyond the spec. If 200 lines could be 50,
   rewrite it. Do not "improve" files this phase did not touch.
2. factory/agents/complexity-remover/instructions.md, then
   .claude/skills/typescript-magician/SKILL.md only where the landed types
   need it, and docs/typescript-standards.md. The spec wins on product
   scope.
3. impl/designs/PHASE1_P1.1_PRINCIPAL.md — the decisions that must still hold.
   Settings and principalFromClaims exist for D1; keep them as separate
   private functions.
3a. This anexo's "## Progress" block (the whole Anchor). The close reads every row.
4. The files tickets 1–3 edited (Anchor "Files touched so far"). Do not
   wander the rest of the repo.

## This ticket lands

A net-smaller, easier-to-follow version of the same slice:
- Remove unused helpers, extra types, and wrapper layers.
- Inline single-use functions when the call site is clearer than the name,
  except the D1 seam (resolveSettings, principalFromClaims) and
  brandPrincipalId.
- Collapse duplicate error paths that do the same thing.
- Keep public names the spec froze. Private names may shrink.

If the landed code is already as small as the spec allows, say so in the
Report, change nothing, and still run the green-when fences.

## Rules specific to this ticket

- No new behavior, no new tests except to replace a test that only existed
  to cover deleted private structure.
- No drive-by refactors outside this slice's files.
- No new dependencies. No eslint-disable beyond the one in brandPrincipalId.
- Do not fix failures that tickets 1–3 should have caught. Stop and report the
  owning ticket. Do not loosen or delete tests to go green.

## Green when

You must run these before reporting green.

npm run typecheck && npm run lint && npm run format:check && npm run deps:check
node --test 'src/identity/**/*.test.ts' test/contract/identity.test.ts
rg -l "from [\"']jose" src/identity --glob '!src/identity/verifier.ts'      # prints nothing
rg -i "auth0|okta|entra|azure|keycloak|cognito|google" src/identity         # prints nothing
rg -n "console\.|logger|\.log\(" src/identity --glob '!*.test.ts'           # prints nothing
docker compose up -d openfga && npm test
Line count of the slice did not grow without a named reason in the Report.

## Report

End with these six headings, in this order (a Stop hook rejects a Report without them):
### Done
### Not done
### Commands            (each command -> exit code)
### Choices the spec was silent on   (or "none")
### Discovered issues   (each -> owner: ticket #, spec, or pre-existing)
### Files touched
Under Done, list what you deleted or inlined and the skills you applied.
Under Discovered issues, name the owning ticket of any failure that did not come from
this simplify, and stop.
```
