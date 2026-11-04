# License and publishing inputs

**Kind:** docs
**Source:** `/workspace/dbos-agent/node_modules/@dbos-inc/dbos-sdk` (@dbos-inc/dbos-sdk 5.4.0 as installed, MIT, pin `5.4.0`); `/workspace/authz-engine` (owner authz-engine design repository, owner design, pin `design 2026-11-03`); `/workspace/attach/navier/src` (Navier src (navier.zip), owner code, read-only, pin `zip 2026-11-04`). Cites below are `tree/path:line` relative to each root.
**Concerns:** P7.3
**Verdict axis:** live
**Status:** ready

**Question:** What licences and docs constrain publishing Navier?

## Answer in plain language

The DBOS SDK is MIT. authz-engine proposes Apache-2.0 for its patent grant. Navier's `src` has no license header of its own (only vendored gRPC health stubs carry Apache headers, and those are deleted by [P4.5](../../phase-4/PHASE4_P4.5_GRPC_REMOVAL.md)). An Apache-2.0 Navier embedding authz-engine (Apache-2.0) and DBOS (MIT) has no licence conflict.

## Why it matters for this project

Sets the license gate.

## How it works

Read package metadata and the authz-engine license spec.

## Key findings and evidence

- DBOS SDK licence. [S] `dbos/package.json:1-10`
- authz-engine Apache-2.0 proposal. [S] `aze/phases/phase-0/PHASE0_P0.2_LICENSE_GOVERNANCE.md:42-46`
- authz-engine README. [S] `aze/README.md:1-10`
- Vendored Apache header in gRPC stubs. [S] `navier/identity/gen/grpc/health/v1/health_pb.d.ts:1-12`

## Limits and unknowns

Navier repository root (LICENSE, package.json) not provided [U].

## Research recommendation

**Recommendation:** adopt — Apache-2.0 as gate A.
**Why / consequences:** MIT lacks a patent grant.
**Do not copy:** Claim the current Navier license. Notes describe and cite; no product code enters this repository.

## Technical references

### File map

#### P0 — read first

| File / source | What question it helps verify |
|---------------|-------------------------------|
| `aze/phases/phase-0/PHASE0_P0.2_LICENSE_GOVERNANCE.md` | license |

#### P1 — implementation detail

| File / source | When to open it |
|---------------|-----------------|
| `dbos/package.json` | licence |
