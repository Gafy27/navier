# Requirements

Engine laws, layout, phases. Agent behavior lives in
[`../policy/rules.md`](../policy/rules.md). Rust method:
[`../stack/rust/`](../stack/rust/).

## Objective

**Cosmos Engine** (workspace name **rust-engine**) is a **streaming lakehouse
platform** for agent-built data applications: Compass-style **filesystem** and
org APIs, governed tables and deployments (Foundry / Ontology / AIP as primary
product references; Databricks / Snowflake as secondary operational references).
This repository is the **Rust control plane and runtime** — SQL catalog,
`Sink` / `Batch` workers, lakehouse binding, org / filesystem gRPC. **Operated
compute:** RisingWave for streaming and hot SQL; Daft for large Iceberg
analytics (product direction, Phase 9+). Specs in `paths.designs` and shipped
crates are authoritative.

`python-engine/` is a **deprecated prototype**; it is not a parity target and
must not gate design or implementation.

Inspiration under `inspiration/` is patterns, not a fork. We are **not**
rewriting RisingWave's stream engine, planner, or Hummock. RisingWave is
operated for hot streaming SQL, Kafka-linked objects, Iceberg sinks, and
staging (pgwire :4566).

## Engine laws

- Workers have no catalog access; the control plane is a pure renderer plus SQL store
- One write door for org state: `ApplyOrgDocument` (P7.11)
- RisingWave is operated, not rewritten: hot store, streaming SQL, staging
- Preserve Cosmos semantics: machine-agnostic `Event`, entity in tags
- Crate code lands only against a binding spec in `<paths.designs>/phase-N/` that
  names the subphase
- Dependency direction: workers → `cosmos-control` only, not
  `cosmos-catalog` / `cosmos-scheduler` ([`layering.md`](layering.md))

## Architecture

**cosmos-controller** — control plane: SQL desired-state catalog, admission,
reconcile loop, pure scheduler, RisingWave APPLY (provision pipelines on the
controller — not a worker task), lakehouse sequencer, org + filesystem gRPC,
worker orchestration via gRPC control stream.

**cosmos-worker** — homogeneous task host for **`Sink`** and **`Batch`** only.
Optional Flight SQL and deprecated ontology-action listeners when configured.
No catalog access.

Control-plane crates: `cosmos-control`, `cosmos-catalog`, `cosmos-scheduler`.
Data-plane crates: `cosmos-bridge`, `cosmos-consumer`, `cosmos-stream`,
`cosmos-sink`. Batch: `cosmos-batch`, `cosmos-flight`. Foundation: `cosmos-rt`,
`cosmos-org`, `cosmos-lakehouse`. Utility binary: `bins/cosmos-decrypt`.
`cosmos-ontology` is frozen (Phase 8 stopped).

Data flow (pipeline): User/API → ApplyPipeline → cosmos-controller → Admission
→ Catalog → Reconcile → RenderingPlanner → gRPC AssignTasks → cosmos-worker →
external systems (RisingWave / Kafka / Iceberg).

Data flow (org): ApplyOrgDocument → org service → catalog + provision plans →
same reconcile path.

## Repository layout

| Path | Role |
|------|------|
| `factory/` | Agent kit (this profile, `policy/`, `stack/rust/`) |
| `Cargo.toml` | Workspace root only — no root package |
| `crates/` | Library crates |
| `bins/` | `cosmos-controller`, `cosmos-worker`, `cosmos-decrypt` |
| `obsidian/Cosmos Engine/phases/RUST_LAYOUT.md` | Crate map, binary roles, dependency law |
| `<paths.designs>/phase-N/` | Phase specs + `*_TICKETS.md`; `prompts/`, `history/`, `indexing/`, `reviews/` |
| `paths.reviews` (phase N) | Design reviews and reliability/security assessments for that phase |
| `python-engine/` | Deprecated prototype (archaeology only) |
| `inspiration/` | Reference codebases |
| `.agents/skills/`, `.agents/agents/` | Host skills and named agents |

## Phases

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | `crates/cosmos-rt` process shell | closed enough |
| 1 | Control plane | landed P1.1–P1.5 |
| 2 | Data plane (sink, consumer, APPLY) | complete through P2.6b; P2.7 skipped |
| 3 | Batch engine | landed P3.1–P3.3 |
| 4 | Streaming lakehouse | indexing / active |
| 5 | User SQL read path | P5.1–P5.3 landed |
| 6 | Payload encryption | P6.1 binding; P6.2–P6.4 parked |
| 7 | Compass filesystem + governance, org apply | indexing / draft |
| 8 | Transactional Table API | direction draft only — no spec; do not run tickets |
| 9 | User Python interface | indexing |
| 10 | Typed decisions (`decide(...)`) | indexing |

Do not start crate code until `<paths.designs>/phase-N/` names the subphase.
Do not implement to match `python-engine/` unless a BINDING spec says so.

## Design research before asking

1. Indexes under `<paths.designs>/phase-N/indexing/` (phase README + module notes).
   Method: `paths.index_pattern`. Sessions: kit `policy/indexing.md`.
2. Official design docs the index cites — vocabulary only.
3. Source paths the index cites. On conflict, **source wins**.
4. Then stop and ask per `policy/decisions.md`.

Phase trees: 0–2 RisingWave; 3 DataFusion; 4 `phase-4/`; 5 `phase-5/`.
