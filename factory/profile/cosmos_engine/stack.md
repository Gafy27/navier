# Stack

Technologies this engine uses and which crate owns each. Import ownership:
[`layering.md`](layering.md) and `obsidian/Cosmos Engine/phases/RUST_LAYOUT.md`.

| Technology | Owner | Why |
|------------|-------|-----|
| Rust / Cargo workspace | all crates | Language pack [`../stack/rust/`](../stack/rust/) |
| Tokio | `cosmos-rt`, bins, async crates | Process runtime; Fast Tokio when spawn/locks |
| RisingWave (operated) | `cosmos-bridge` client / controller APPLY | Hot streaming SQL, Kafka-linked objects, Iceberg sinks |
| Kafka / librdkafka | `cosmos-bridge` kafka + `cosmos-consumer` | Source topics, sink produce |
| Iceberg | `cosmos-lakehouse`, `cosmos-bridge` iceberg feature | Table binding; nobody else enables the feature in P4.1 |
| DataFusion / Arrow | `cosmos-batch`, `cosmos-flight` | Batch and Flight SQL; no rdkafka on those crates |
| SQLite + Postgres (catalog URL) | `cosmos-catalog` | JobSpec store; `sqlite::memory:` in tests |
| tonic / prost | `cosmos-control` | Control-plane gRPC |
| Graphify | `paths.graphify_root`, `paths.graphify_graph` | Selected graph before code exploration; `policy/graphify.md` |
