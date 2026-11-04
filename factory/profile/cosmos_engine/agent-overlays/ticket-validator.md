## This repo

When `scripts/harness/snapshot.sh` exists, do not copy the tree by hand.
Snapshot, then use a detached worktree, and run every row only there:

```
SHA=$(scripts/harness/snapshot.sh validate-<stem>-<k>)
WT=$(scripts/harness/worktree.sh refs/harness/snap/validate-<stem>-<k> validate)
```

Set `CARGO_TARGET_DIR` to the absolute `<repo>/target/harness/cargo`. If the
snapshot or worktree cannot be created, verdict `UNRUNNABLE`. Do not attack
the live working tree instead.
