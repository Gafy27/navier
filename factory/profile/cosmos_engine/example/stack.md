<!-- UNFILLED -->
# Stack

Technologies this product uses and which unit owns each. Import
ownership: [`layering.md`](layering.md) and the layout file.

| Technology | Owner | Why |
|------------|-------|-----|
| Language workspace | all units | Language pack `../stack/<project.language>/` (this example: [`../../stack/rust/`](../../stack/rust/)) |
| Process runtime | `example-rt`, bins, async units | Runtime skill when spawn/locks |
| Operated store | `example-bridge` / controller apply | Hot queries, sinks — not rewritten |
| Message bus | `example-bridge`, `example-sink` | Source and produce |
| Table format | `example-lakehouse` | Binding; nobody else enables the feature |
| Catalog URL | `example-catalog` | Desired state; in-memory in tests |
| Control RPC | `example-control` | Control-plane API |
| Graphify | repo `graphify-out/` | Before exploring unit code (`tools.graphify`) |

Rewrite owners and rows for the real product. Delete `<!-- UNFILLED -->`.
