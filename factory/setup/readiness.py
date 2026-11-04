"""Deterministic Factory setup checks (no install, no runtime verification)."""

from __future__ import annotations

import re
from pathlib import Path

import yaml

from setup.context import InstallContext

REQUIRED_PROFILE = (
    "README.md",
    "requirements.md",
    "layering.md",
    "stack.md",
    "code-style.md",
    "testing.md",
    "skills.md",
    "tickets.md",
    "agents.md",
)
PLACEHOLDERS = re.compile(
    r"\b(?:TODO|TBD|CHANGEME|UNFILLED)\b|<\!--\s*UNFILLED\s*-->", re.I
)


def project_path(root: Path, value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else root / path


def detect_facts(root: Path) -> list[str]:
    markers = {
        "Cargo workspace": "Cargo.toml",
        "Rust manifest": "Cargo.toml",
        "Python project": "pyproject.toml",
        "Node project": "package.json",
        "Go module": "go.mod",
        "Java build": "pom.xml",
        "Make targets": "Makefile",
        "Taskfile": "Taskfile.yml",
    }
    return [
        f"{label}: {root / marker}"
        for label, marker in markers.items()
        if (root / marker).is_file()
    ]


def readiness(ctx: InstallContext, installer_module) -> tuple[list[str], list[str]]:
    """Return (detected_facts, problems). installer_module is factory.install."""
    problems: list[str] = []
    facts = detect_facts(ctx.root)
    config_path = ctx.kit / "config.yaml"
    if not config_path.is_file():
        return facts, [
            f"Missing {config_path}. Copy Factory into this project, then configure "
            "paths, commands, and project metadata."
        ]
    try:
        cfg = yaml.safe_load(config_path.read_text())
    except (OSError, yaml.YAMLError):
        return facts, [f"Cannot read {config_path} as a YAML mapping."]
    if not isinstance(cfg, dict):
        return facts, [f"{config_path} must contain a YAML mapping."]
    for key in ("project", "paths", "commands", "tools"):
        if not isinstance(cfg.get(key), dict):
            problems.append(f"{config_path.name}: {key} must be a mapping.")
    project = cfg.get("project") if isinstance(cfg.get("project"), dict) else {}
    for key in ("name", "language"):
        if not isinstance(project.get(key), str) or not project[key].strip():
            problems.append(
                f"project.{key} must be non-empty text based on this repository."
            )
    paths = cfg.get("paths") if isinstance(cfg.get("paths"), dict) else {}
    kit_rel = ctx.kit_relpath()
    profile_setting = paths.get("profile", f"{kit_rel}/profile")
    if not isinstance(profile_setting, str) or not profile_setting.strip():
        problems.append("paths.profile must be a non-empty directory path.")
        profile_setting = f"{kit_rel}/profile"
    profile = project_path(ctx.root, profile_setting)
    missing = [name for name in REQUIRED_PROFILE if not (profile / name).is_file()]
    if missing:
        problems.append(
            f"Profile {profile} is missing: {', '.join(missing)}. Copy templates "
            f"from {kit_rel}/profile/example/ and adapt them to this project."
        )
    for name in REQUIRED_PROFILE:
        file = profile / name
        if file.is_file() and PLACEHOLDERS.search(file.read_text()):
            problems.append(f"Resolve placeholders in {file}.")
    problems.extend(installer_module.custom_profile_problems(cfg, ctx.root))
    if not any(
        f"{key} must be a mapping" in problem
        for problem in problems
        for key in ("project", "paths", "tools")
    ):
        problems.extend(installer_module.agent_contract_problems(cfg, ctx.kit))
    testing = profile / "testing.md"
    if testing.is_file():
        body = testing.read_text()
        if PLACEHOLDERS.search(body):
            problems.append(f"Resolve placeholders in {testing}.")
        for target in re.findall(r"\[[^]]*\]\(([^)]+)\)", body):
            if target.startswith(("http://", "https://", "#", "mailto:")):
                continue
            destination = (testing.parent / target.split("#", 1)[0]).resolve()
            if not destination.exists():
                problems.append(f"{testing} links to missing local path: {target}.")
    if isinstance(cfg.get("commands"), dict):
        for name, command in cfg["commands"].items():
            if command is not None and not isinstance(command, (str, list, dict)):
                problems.append(
                    f"commands.{name} must be a string, list, mapping, or empty."
                )
    return facts, problems
