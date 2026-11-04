"""Factory kit setup/install library. Run the CLI via `python3 factory/cli.py`."""

from setup.context import InstallContext, default_project_root, resolve_context
from setup import installer as installer
from setup.readiness import REQUIRED_PROFILE, readiness

__all__ = [
    "InstallContext",
    "default_project_root",
    "resolve_context",
    "installer",
    "REQUIRED_PROFILE",
    "readiness",
]
