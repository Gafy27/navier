"""Resolve host project root and kit directory for any Factory layout."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class InstallContext:
    """Host repo root and on-disk kit tree (contains config.yaml)."""

    root: Path
    kit: Path

    def kit_relpath(self) -> str:
        """POSIX path from project root to kit (for docs and default paths.kit)."""
        try:
            return Path(os.path.relpath(self.kit.resolve(), self.root.resolve())).as_posix()
        except ValueError:
            return self.kit.resolve().as_posix()


def _has_config(directory: Path) -> bool:
    return (directory / "config.yaml").is_file()


def resolve_context(
    *,
    root: Path | None = None,
    kit: Path | None = None,
    script: Path | None = None,
    cwd: Path | None = None,
) -> InstallContext:
    """Pick project root and kit. Prefer explicit --root / --kit, then script location, then cwd."""
    work = (cwd or Path.cwd()).resolve()
    script_kit = script.resolve().parent if script is not None else None

    resolved_kit: Path | None = kit.resolve() if kit is not None else None
    resolved_root: Path | None = root.resolve() if root is not None else None

    if resolved_kit is not None:
        if not _has_config(resolved_kit):
            raise ValueError(f"Kit directory has no config.yaml: {resolved_kit}")
        if resolved_root is None:
            resolved_root = resolved_kit.parent
    elif resolved_root is not None:
        configured = resolved_root / "factory"
        if _has_config(configured):
            resolved_kit = configured
        else:
            raise ValueError(
                f"No config at {configured}. "
                "Pass --kit to the directory that contains config.yaml."
            )
    elif script_kit is not None and _has_config(script_kit):
        resolved_kit = script_kit
        resolved_root = resolved_root or script_kit.parent
    elif _has_config(work / "factory"):
        resolved_root = work
        resolved_kit = work / "factory"
    else:
        raise ValueError(
            "Could not locate Factory config.yaml. Run from the project root, "
            "or pass --root and optionally --kit."
        )

    if resolved_root is None:
        resolved_root = resolved_kit.parent
    return InstallContext(root=resolved_root.resolve(), kit=resolved_kit.resolve())


def default_project_root(*, script: Path | None = None, cwd: Path | None = None) -> Path:
    """Default --root for CLI when the kit sits next to this script or under cwd."""
    work = (cwd or Path.cwd()).resolve()
    script_kit = script.resolve().parent if script is not None else None
    if script_kit is not None and _has_config(script_kit):
        return script_kit.parent.resolve()
    if _has_config(work / "factory"):
        return work.resolve()
    return work.resolve()
