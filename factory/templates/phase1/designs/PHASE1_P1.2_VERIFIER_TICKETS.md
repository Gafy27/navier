# P1.2 Verifier — tickets and session prompts

Companion to [`PHASE1_P1.2_VERIFIER.md`](./PHASE1_P1.2_VERIFIER.md), not a
replacement. The spec owns the law, the decisions, and the trade-offs. This
file owns the ticket rows, the sequence, the file fences, and **one
paste-ready prompt per session**.

Copy **one SESSION block** into a **new agent session** with this repo as the
working directory. Do not paste two tickets into one chat. Do not resume the
previous ticket's chat. No code lands with this document.

To run the whole anexo without pasting: a **new** chat with
`run tickets impl/designs/PHASE1_P1.2_VERIFIER_TICKETS.md` (skill
`ticket-orchestrator`). That parent still launches one fresh subagent per
SESSION block.

If the spec is ambiguous or you believe it is wrong, **stop and report** — do
not resolve it yourself and do not invent a variant.

Each session **must run** the repo-wide gates and the tests for the phase
folders it may edit, plus any extra rows its Green when names. It must **not**
run another phase's tests. The full `npm test` runs on the **last ticket
only**.

**The last ticket is always simplify.** Ticket 4 reads the code this slice
landed and deletes complexity, and closes Phase 1. It uses
`complexity-remover` and
`.claude/skills/typescript-magician/SKILL.md`.

- It adds no feature, changes no spec, and widens no public API.
- It does **not** fix failures from tickets 1–3. If a gate fails for another
  reason, stop and report the owning ticket.
- Do not loosen asserts or delete tests.

## Prerequisite

- [`PHASE1_P1.1_PRINCIPAL_TICKETS.md`](./PHASE1_P1.1_PRINCIPAL_TICKETS.md) is
  fully GREEN.
- The spec's gates are answered (D3, D4; decision log Q26, Q27).
- The spec is `BINDING`.

## Sequence

```
1 -> 2 -> 3 -> 4
```

Strictly serial. Tickets 2 and 3 both edit `src/identity/verifier.ts`, and
ticket 2 depends on ticket 1's helper.

## Tickets

| # | Ticket | Files it may edit | Green when |
|---|--------|-------------------|------------|
| 1 | Test signer and local JWKS server with `node:crypto` and `node:http` (D5) | `test/helpers/jwt.ts`, `test/helpers/jwt.test.ts` | Repo gates, `node --test test/helpers/jwt.test.ts`. V11 holds |
| 2 | Install `jose` pinned; `TokenVerifier.verify`, `createTokenVerifier`, header parsing, resolver wrapper, error mapping (D1, D2, D3, D6) | `package.json`, `package-lock.json`, `src/identity/verifier.ts`, `src/identity/verifier.test.ts`, `src/identity/index.ts`, `test/contract/identity.test.ts` | Phase fence. V1–V4, V7–V10, V12, V13, V14 hold |
| 3 | Readiness probe `identity-jwks` (D4) | `src/identity/verifier.ts`, `src/identity/verifier.test.ts`, `test/contract/identity.test.ts` | Phase fence. V5, V6 hold |
| 4 | Simplify the landed slice (complexity-remover) and close Phase 1. No new behavior | Only files tickets 1–3 edited, plus the Phase 1 row of `impl/designs/README.md` | Repo gates, phase tests, then `npm test`. V13–V15 hold |

## Validation contract

Written in the **design session, before any code**. Each row names a way to
break one spec law or D. When the review level is `full`,
Ticket tests exercise validation rows after green; at `full`, `code-reviewer` reviews the diff on a
snapshot of the tree, never on the working tree. Every `probe`
signs tokens with `test/helpers/jwt.ts` and serves keys from its local server
on port 0. None mocks `jose` or `fetch`. Unless a row says otherwise, the
config is `requireTls: false`, claim mode `gty=client-credentials`,
namespace `corp`, `IDP_JWKS_TIMEOUT_MS: 300`, `IDP_CLOCK_TOLERANCE_S: 0`.

| V# | Attacks | Kind | Attack | Observable failure | Owner |
|----|---------|------|--------|--------------------|-------|
| V1 | G1, D3 | `probe` | `verify` with: expired; wrong `aud`; wrong `iss`; `alg: none`; `HS256` signed with the RSA public key bytes; signed by an unpublished key with a published `kid`; unknown `kid`; no header; `sub: 'a#b'`; `nbf` 10 min ahead; no `exp` | Reasons are not, in order, `expired`, `wrong_audience`, `wrong_issuer`, `algorithm_not_allowed`, `algorithm_not_allowed`, `bad_signature`, `unknown_key`, `missing`, `bad_subject`, `not_yet_valid`, `malformed`; any code is not `unauthenticated`; messages differ | 2 |
| V2 | G6, D3 | `probe` | Tokens carry `sub: 'sub-zz7'` and a claim `secret: 'claim-zz8'`. Run every V1 case and one valid token. `JSON.stringify` and `util.inspect` (depth Infinity) every result | Any output contains `zz7`, `zz8`, or any substring of 20+ characters of a token; any `AuthError` has a `cause` key | 2 |
| V3 | G4, D3 | `probe` | A valid token against a JWKS server that (a) refuses connections, (b) answers 500, (c) never answers | Any result is not `unavailable`, (c) takes over 1 s, or `verify` rejects | 2 |
| V4 | D2 | `probe` | A valid token `t`. Headers `''`, `'Bearer'`, `'Bearer '`, `'Basic ' + t`, `'Bearer  ' + t`, `'Bearer ' + t + ' x'`, `'bearer ' + t`, `'BEARER ' + t` | `''` is not `missing`; the next four are not `malformed`; either of the last two is not `ok` | 2 |
| V5 | G5, D4 | `probe` | Create a verifier; read the server's request count. Then `probe.check` with the server serving, then again at once. Then a fresh verifier with the server closed and `probe.check` | Count is not 0 after create; the first check rejects; the second check fetched again; the closed-server check resolves | 3 |
| V6 | G5, D4 | `probe` | `createCoreServer` (plaintext, `PORT` 0 literal), `addProbe(verifier.probe)`, JWKS server closed. Inject `/readyz`. Then a verifier whose server serves | First is not 503 with `failing: ['identity-jwks']`, or the second is not 200 | 3 |
| V7 | D1 | `probe` | Token with `exp` 5 s ago. `IDP_CLOCK_TOLERANCE_S: 10`, then `0` | Tolerance 10 is not `ok`, or tolerance 0 is not `expired` | 2 |
| V8 | D1 | `probe` | Ten valid `verify` calls in sequence and ten concurrently on one verifier | The JWKS server saw more than one request | 2 |
| V9 | G2 | `probe` | Claim mode: token with `gty: 'client-credentials'`, and one with `sub: 'x@clients'` and no `gty`. Suffix mode `@clients`: `sub: 'x@clients'`, and `sub: 'x'` with `gty` | Kinds are not `service`, `human`, `service`, `human`, or any id is not `user:corp~<sub>` | 2 |
| V10 | G3 | `probe` | `createTokenVerifier` with both modes; neither; `requireTls: true` and an `http://` URI | Any is `ok`, or a message lacks the variable names the spec lists | 2 |
| V11 | D5 | `cmd` | `rg -n "from [\"']jose" test/` | Any match | 1 |
| V12 | D1 | `read` | Installed `node_modules/jose/package.json` version and `dist/webapi/jwks/remote.js` defaults | Version is not the exact pin in `package.json`, or cooldown is not 30000 or cache age not 600000 | 2 |
| V13 | D1, G7 | `cmd` | `npm run deps:check`; `rg -l "from [\"']jose" src --glob '!src/identity/verifier.ts'`; `rg -i "auth0\|okta\|entra\|azure\|keycloak\|cognito\|google" src/identity`; `node -e` asserting `dependencies.jose` matches `^\d+\.\d+\.\d+$` | deps:check fails, either `rg` prints anything, or the pin is a range | 2 |
| V14 | D6 | `cmd` | `rg -n "^(let\|var) \|^const [a-z].*= (new \|create)" src/identity --glob '!*.test.ts'`; `rg -n "console\.\|logger\|\.log\(" src/identity --glob '!*.test.ts'` | Any match | 2 |
| V15 | phase close | `probe` | `import * as m from './src/identity/index.ts'`; list runtime keys | Keys are not exactly `AuthFailure`, `IdentityConfigSchema`, `PrincipalKind`, `createTokenVerifier`, `parsePrincipalId` | 4 |

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
`.claude/harness/runs/PHASE1_P1.2_VERIFIER_TICKETS/ticket-<N>.md`.

### Anchor

- **Intent:** <!-- PHASE1_P1.2_VERIFIER: JWT verify, remote key set, readiness, Phase 1 close -->
- **Files touched so far:** <!-- cumulative -->
- **Decisions:** <!-- silent choices a human `continue`d, with ticket # -->
- **Open issues → owner / Next:** <!-- issue → ticket or spec; next ticket -->

## Fences every ticket runs

1. Repo-wide gates: `npm run typecheck`, `npm run lint`,
   `npm run format:check`, `npm run deps:check`.
2. For tickets that edit `src/identity/`:
   `node --test 'src/identity/**/*.test.ts' test/contract/identity.test.ts`.
   Ticket 1 runs `node --test test/helpers/jwt.test.ts` instead.
3. Extra rows the ticket's Green when names. No ticket here edits `openfga/`
   or `proto/`. No row needs OpenFGA.

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

Then set the Phase 1 row in `impl/designs/README.md` to `done`, with both
binding designs and their tickets linked. If a gate fails and the failure is
not from the simplify diff, stop and report. Do not mark `done` on a red run.

## What no ticket may do

- Import `jose` outside `src/identity/verifier.ts`, or in any test.
- Mock `jose`, `fetch`, or Fastify. The only fake is the D5 local JWKS server.
- Fetch keys in `createTokenVerifier`, or fail boot on a fetch error (D4).
- Put a `cause` on an `AuthError`, or a token, header, claim, or key in any
  message or `cause` (D3).
- Map a key-set failure to `unauthenticated`, or any failure to `ok` (D3).
- Set `jose` options the spec does not list (`typ`, `maxTokenAge`,
  `cooldownDuration`, `cacheMaxAge`, …).
- Log, or import a logger. Read `process.env` or `REQUIRE_TLS`.
- Commit key material. Name a vendor under `src/identity/` or in its tests.
- Create `src/server.ts` or map errors to gRPC codes. That is Phase 7.
- Use `any`, `enum`, namespaces, parameter properties, or a cast.
- Edit P1.1 files beyond what the ticket names, Phase 0 files, `phase-1.md`,
  the specs, or this anexo outside Progress.

---

## SESSION 1 — Ticket 1: test signer and local JWKS server

```
You are implementing an already-locked spec. This is not a redesign.

Spec: impl/designs/PHASE1_P1.2_VERIFIER.md (BINDING). This session is ticket 1
only. Stop when it is green. Do not start later tickets. Do not edit the design.
Do not touch files other than test/helpers/jwt.ts and its test.

## Read before writing any TypeScript, in this order

1. CLAUDE.md, docs/typescript-standards.md, policy/phase-composition.md,
   policy/tickets.md, policy/testing.md. Non-negotiable.
2. .claude/skills/node/SKILL.md (node:crypto, node:http, type stripping).
   .claude/skills/integration-testing/SKILL.md.
3. impl/designs/PHASE1_P1.2_VERIFIER.md — Context, D5.
3a. This anexo's "## Progress" block (Anchor, your row). Read the prior handoff
    if Attempts >= 1.
4. test/helpers/tls.ts (the generated-at-test-time pattern to follow).

## This ticket lands

test/helpers/jwt.ts, with TSDoc on each export:
- key pairs generated with node:crypto (RSA for RS256, P-256 for ES256), each
  with a kid; the public half exported as a JWK (crypto KeyObject.export
  format 'jwk').
- sign(claims, options): compact JWS for RS256 and ES256 (ES256 signature in
  IEEE P1363 form, dsaEncoding 'ieee-p1363'); options for kid, alg override,
  and signing with a key that is not published.
- unsigned(claims) for alg none, and hs256(claims, secret) for the HMAC case.
- startJwksServer(keys): node:http on 127.0.0.1 port 0; returns url,
  requestCount(), setMode('serve' | 'error500' | 'hang'), and close(). After
  close(), the URL refuses connections. No timer outlives close().
- jwt.test.ts: a self-test that the server serves the JWKS, counts requests,
  each mode behaves, and tokens decode to the given header and claims.

## Rules specific to this ticket

- No jose, anywhere under test/. No committed keys. No vendor names.
- No src/ changes.

## Green when

You must run these before reporting green. Do not skip them. Do not
substitute the full suite.

npm run typecheck && npm run lint && npm run format:check && npm run deps:check
node --test test/helpers/jwt.test.ts
rg -n "from [\"']jose" test/            # prints nothing
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

## SESSION 2 — Ticket 2: jose, verify, error mapping

```
You are implementing an already-locked spec. This is not a redesign.

Spec: impl/designs/PHASE1_P1.2_VERIFIER.md (BINDING). This session is ticket 2
only. Stop when it is green. Do not start later tickets. Do not edit the design.
Do not touch folders other than src/identity/, test/contract/, and the
package manifest and lockfile.

## Read before writing any TypeScript, in this order

1. CLAUDE.md, docs/typescript-standards.md, policy/phase-composition.md,
   policy/tickets.md, policy/testing.md. Non-negotiable.
2. .claude/skills/typescript-magician/SKILL.md (narrowing thrown unknown,
   exhaustive mapping). .claude/skills/safe-types-untrusted-input/SKILL.md.
   .claude/skills/node/SKILL.md. .claude/skills/integration-testing/SKILL.md.
3. impl/designs/PHASE1_P1.2_VERIFIER.md — Context (measured jose table),
   "APIs" (normative), D1, D2, D3, D6, G1–G4, G6, G7.
   impl/designs/PHASE1_P1.1_PRINCIPAL.md — "APIs", D1, D3, D5, D6.
3a. This anexo's "## Progress" block (Anchor, your row). Read the prior handoff
    if Attempts >= 1.
4. src/identity/ (all of P1.1), src/core/index.ts, test/helpers/jwt.ts.

## This ticket lands

- jose installed with an exact pin: run `npm view jose version` first and
  record it; `npm install --save-exact jose@<that>`. Confirm each algorithm
  in P1.1 D4's list verifies with a public JWK on that version (a scratch
  check, not committed). If one does not, stop and report.
- src/identity/verifier.ts (the only file that imports jose):
  createTokenVerifier(config, deps) — resolveSettings, then one
  createRemoteJWKSet with timeoutDuration only (D1). TokenVerifier.verify per
  D2 (header) and D3 (private resolver wrapper with a private KeysUnavailable
  error; mapping table; rethrow unclassified), then principalFromClaims.
  The `probe` property is required by the type. Until ticket 3, its check
  rejects with `new Error('not implemented')`. Say so in the Report.
- index.ts re-exports TokenVerifier and createTokenVerifier with TSDoc
  (contract, every error code, side effects: may fetch IDP_JWKS_URI within
  IDP_JWKS_TIMEOUT_MS; never logs).
- verifier.test.ts and contract rows in test/contract/identity.test.ts for
  every G1 case, G2, G3, G4, G6, D2, clock tolerance, and the cache (one fetch
  for many verifies). Use test/helpers/jwt.ts; never mock jose or fetch.

## Rules specific to this ticket

- jwtVerify options are exactly the D1 table. No other jose option.
- AuthError never has a cause. The unavailable error's cause is the fetch
  error and nothing else.
- No readiness logic beyond the placeholder. That is ticket 3.

## Green when

You must run these before reporting green. Do not skip them. Do not
substitute the full suite.

npm run typecheck && npm run lint && npm run format:check && npm run deps:check
node --test 'src/identity/**/*.test.ts' test/contract/identity.test.ts
rg -l "from [\"']jose" src --glob '!src/identity/verifier.ts'               # prints nothing
rg -i "auth0|okta|entra|azure|keycloak|cognito|google" src/identity         # prints nothing
rg -n "console\.|logger|\.log\(" src/identity --glob '!*.test.ts'           # prints nothing
node -e "const v=require('./package.json').dependencies.jose; if(!/^\d+\.\d+\.\d+$/.test(v)) process.exit(1)"
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

## SESSION 3 — Ticket 3: readiness probe

```
You are implementing an already-locked spec. This is not a redesign.

Spec: impl/designs/PHASE1_P1.2_VERIFIER.md (BINDING). This session is ticket 3
only. Stop when it is green. Do not start later tickets. Do not edit the design.
Do not touch files other than src/identity/verifier.ts, its test, and
test/contract/identity.test.ts.

## Read before writing any TypeScript, in this order

1. CLAUDE.md, docs/typescript-standards.md, policy/phase-composition.md,
   policy/tickets.md, policy/testing.md. Non-negotiable.
2. .claude/skills/node/SKILL.md. .claude/skills/integration-testing/SKILL.md.
   .claude/skills/fastify-best-practices/SKILL.md then rules/testing.md only
   (app.inject on the core server).
3. impl/designs/PHASE1_P1.2_VERIFIER.md — D4, G5.
   impl/designs/PHASE0_P0.2_SERVER.md — "APIs" (ReadinessProbe), D5, D6.
3a. This anexo's "## Progress" block (Anchor, your row). Read the prior handoff
    if Attempts >= 1.
4. src/identity/verifier.ts from ticket 2, src/core/index.ts,
   test/helpers/jwt.ts.

## This ticket lands

- Replace the placeholder probe with D4: name 'identity-jwks', timeoutMs
  IDP_JWKS_TIMEOUT_MS, check resolves without I/O when the key set is fresh,
  otherwise awaits reload() and rejects with the fetch error.
- Tests: no fetch at create; fresh → no fetch; closed server → rejects; and a
  core server (createCoreServer with a plaintext CoreConfig literal, PORT 0)
  with addProbe(verifier.probe) answering /readyz 503 with
  failing ['identity-jwks'] when the JWKS is down, 200 when it serves.

## Rules specific to this ticket

- Do not fetch in createTokenVerifier. Do not set cacheMaxAge or
  cooldownDuration to make tests faster.
- Do not register the probe from identity code. src/server.ts does that.

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

## SESSION 4 — Ticket 4: simplify landed code and close Phase 1

```
You are implementing an already-locked spec. This is not a redesign.

Spec: impl/designs/PHASE1_P1.2_VERIFIER.md (BINDING). This session is ticket 4
only — the mandatory simplify pass and the Phase 1 close. Stop when it is
green. Do not start other tickets. Do not edit the design. Do not touch phase
folders this ticket does not name. Do not add features, types, or public API.

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
3. impl/designs/PHASE1_P1.2_VERIFIER.md and PHASE1_P1.1_PRINCIPAL.md — the
   decisions that must still hold. The D3 resolver wrapper and the P1.1 D1
   seam stay.
3a. This anexo's "## Progress" block (the whole Anchor). The close reads every row.
4. The files tickets 1–3 edited (Anchor "Files touched so far"). Do not
   wander the rest of the repo.

## This ticket lands

A net-smaller, easier-to-follow version of the same slice:
- Remove unused helpers, extra types, and wrapper layers.
- Inline single-use functions when the call site is clearer than the name,
  except the seams the specs name.
- Collapse duplicate error-mapping arms that return the same reason.
- Keep public names the specs froze. Private names may shrink.

Then close Phase 1: set the Phase 1 row of impl/designs/README.md to `done`,
linking PHASE1_P1.1_PRINCIPAL.md, PHASE1_P1.2_VERIFIER.md, and both tickets
files. Only after every command below exits 0.

If the landed code is already as small as the specs allow, say so in the
Report, change nothing in code, and still run the green-when fences.

## Rules specific to this ticket

- No new behavior, no new tests except to replace a test that only existed
  to cover deleted private structure.
- No drive-by refactors outside this slice's files.
- No new dependencies. No eslint-disable beyond P1.1's brandPrincipalId.
- Do not fix failures that tickets 1–3 should have caught. Stop and report the
  owning ticket. Do not loosen or delete tests to go green.

## Green when

You must run these before reporting green.

npm run typecheck && npm run lint && npm run format:check && npm run deps:check
node --test 'src/identity/**/*.test.ts' test/contract/identity.test.ts
rg -l "from [\"']jose" src --glob '!src/identity/verifier.ts'               # prints nothing
rg -n "from [\"']jose" test/                                                 # prints nothing
rg -i "auth0|okta|entra|azure|keycloak|cognito|google" src/identity         # prints nothing
rg -n "console\.|logger|\.log\(" src/identity --glob '!*.test.ts'           # prints nothing
docker compose up -d openfga && npm test
src/identity/index.ts exports exactly the P1.1 and P1.2 APIs, each with TSDoc.
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
