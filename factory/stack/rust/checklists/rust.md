# Rust checklist

Load when `project.stack` in `config.yaml` includes `rust`.

Severity: HIGH.

When reviewing Rust:

- **Unvalidated input** — Bytes, SQL, JSON, or env parsed more than once, or
  used as `String` behind the boundary
- **Stringly APIs** — Modes, ids, or states as `&str` / `bool` where an enum
  or newtype exists
- **Lock across await** — `Mutex` / `RwLock` guard held over `.await`
- **Unbounded spawn** — `tokio::spawn` in a loop without a semaphore, `JoinSet`
  cap, or backpressure
- **Error swallowed** — `let _ =`, empty `Err` arm, or `unwrap` on a library path
- **Workspace test instead of crate** — ticket ran `cargo test --workspace`
  when Green when named `-p <crate>`
- **Clippy allow without why** — `#[allow]` with no same-line reason

```rust
// BAD: lock held across await
let mut g = state.lock().await;
g.send(msg).await?;

// GOOD: extract, drop, then await
let tx = { let g = state.lock().await; g.sender.clone() };
tx.send(msg).await?;
```
