# Setup/install library

Python modules for Factory onboarding and host install (`context`, `readiness`,
`installer`, Click commands in `commands.py`).

**Entry point:** [`../cli.py`](../cli.py) — the only script you run
(`python3 factory/cli.py setup|check|install`).

This folder is named `setup/` (not `cli/`) because [`../cli/`](../cli/) is the
BINDING TypeScript ticket runner, and Python cannot load both a `cli.py` file and
a `cli/` package from the same directory.
