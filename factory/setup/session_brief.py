"""Build a ticket session brief so implementers skip kit discovery loops."""

from __future__ import annotations

import re
from pathlib import Path

import yaml

from setup.context import InstallContext

_SESSION_HEADING = re.compile(r"^## SESSION\s+(\d+)\b", re.MULTILINE)
_FENCE = re.compile(r"```\s*\n(.*?)```", re.DOTALL)


def load_kit_config(kit: Path) -> dict:
    with (kit / "config.yaml").open(encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    if not isinstance(data, dict):
        raise ValueError(f"{kit}/config.yaml must be a mapping")
    return data


def session_numbers(markdown: str) -> list[int]:
    return [int(match.group(1)) for match in _SESSION_HEADING.finditer(markdown)]


def brief_path_for(
    ctx: InstallContext,
    *,
    anexo: Path,
    session: int,
) -> Path:
    cfg = load_kit_config(ctx.kit)
    paths = cfg.get("paths") or {}
    runs = Path(paths.get("runs") or ".claude/harness/runs")
    if not runs.is_absolute():
        runs = (ctx.root / runs).resolve()
    return runs / anexo.resolve().stem / f"ticket-{session}-brief.md"


def bundle_all_sessions(ctx: InstallContext, *, anexo: Path) -> list[Path]:
    anexo = anexo.resolve()
    text = anexo.read_text(encoding="utf-8")
    numbers = session_numbers(text)
    if not numbers:
        raise ValueError(f"No ## SESSION headings in {anexo}")
    return [bundle_session(ctx, anexo=anexo, session=n) for n in numbers]


def _session_fence(markdown: str, session_num: int) -> str:
    matches = list(_SESSION_HEADING.finditer(markdown))
    for index, match in enumerate(matches):
        if int(match.group(1)) != session_num:
            continue
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(markdown)
        block = markdown[start:end]
        fence = _FENCE.search(block)
        if not fence:
            raise ValueError(f"SESSION {session_num} has no ``` fenced prompt")
        return fence.group(1).strip()
    raise ValueError(f"No ## SESSION {session_num} in tickets file")


def _section(fence: str, heading: str) -> str:
    pattern = re.compile(
        rf"^{re.escape(heading)}\s*\n(.*?)(?=^## |\Z)",
        re.MULTILINE | re.DOTALL,
    )
    hit = pattern.search(fence)
    return hit.group(1).strip() if hit else ""


def _read_bounded(path: Path, max_lines: int = 200) -> str:
    if not path.is_file():
        return f"(missing: `{path}` — setup gap; stop and report)\n"
    lines = path.read_text(encoding="utf-8").splitlines()
    if len(lines) <= max_lines:
        return "\n".join(lines) + "\n"
    head = "\n".join(lines[:max_lines])
    return f"{head}\n\n… truncated ({len(lines)} lines); open `{path}` for the rest.\n"


def _rel(root: Path, path: Path) -> str:
    try:
        return path.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        return path.resolve().as_posix()


def bundle_session(
    ctx: InstallContext,
    *,
    anexo: Path,
    session: int,
) -> Path:
    anexo = anexo.resolve()
    if not anexo.is_file():
        raise ValueError(f"Anexo not found: {anexo}")

    cfg = load_kit_config(ctx.kit)
    paths = cfg.get("paths") or {}
    tools = cfg.get("tools") or {}
    project = cfg.get("project") or {}
    language = project.get("language") or "python"

    profile = Path(paths.get("profile") or "factory/profile/example")
    if not profile.is_absolute():
        profile = (ctx.root / profile).resolve()
    kit = ctx.kit
    runs = Path(paths.get("runs") or ".claude/harness/runs")
    if not runs.is_absolute():
        runs = (ctx.root / runs).resolve()
    memory = Path(paths.get("memory") or "factory/memory")
    if not memory.is_absolute():
        memory = (ctx.root / memory).resolve()

    fence = _session_fence(anexo.read_text(encoding="utf-8"), session)
    green_when = _section(fence, "## Green when")
    lands = _section(fence, "## This ticket lands")
    rules = _section(fence, "## Rules specific to this ticket")
    read_block = _section(fence, "## Read before writing code, in this order")

    layering = profile / "layering.md"
    code_style = profile / "code-style.md"
    testing = profile / "testing.md"
    stack_tickets = kit / "stack" / language / "tickets.md"
    implementation = kit / "policy" / "implementation.md"
    repo_rules = paths.get("repo_rules") or "AGENTS.md"
    repo_rules_path = ctx.root / repo_rules

    skill_paths = [
        kit / "skills" / "ponytail" / "SKILL.md",
        kit / "skills" / "caveman" / "SKILL.md",
        kit / "skills" / "ticket-testing" / "SKILL.md",
        kit / "skills" / "secure-code-writing" / "SKILL.md",
        kit / "skills" / "naming" / "SKILL.md",
    ]
    stack_skills = kit / "stack" / language / "skills.md"

    memory_note = ""
    memory_index = memory / "MEMORY.md"
    if memory_index.is_file():
        memory_note = _read_bounded(memory_index, 40)

    out_dir = runs / anexo.stem
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"ticket-{session}-brief.md"

    lines: list[str] = [
        f"# Session brief — {anexo.name} — SESSION {session}",
        "",
        "Generated by `python3 factory/cli.py bundle-session`. Read this file "
        "first, then only paths named below. Use the **Read** tool; do not "
        "`cat`/`ls` the kit tree to discover files.",
        "",
    ]
    if session > 1:
        lines.extend(
            [
                "## Token discipline",
                "",
                "Serial ticket N > 1: do **not** run Green-when or unrelated "
                "tests before editing. Read named sources below, implement, "
                "then run Green-when. See `factory/policy/tickets.md` § Token "
                "discipline.",
                "",
            ]
        )
    lines.extend(
        [
        "## Green when",
        "",
        green_when or "(see SESSION fence in the anexo)",
        "",
        "## This ticket lands",
        "",
        lands or "(see SESSION fence)",
        "",
        ]
    )
    if rules:
        lines.extend(["## Rules specific to this ticket", "", rules, ""])

    lines.extend(
        [
            "## Bootstrap laws (inlined)",
            "",
            f"### `{_rel(ctx.root, repo_rules_path)}`",
            "",
            _read_bounded(repo_rules_path, 80),
            f"### `{_rel(ctx.root, layering)}`",
            "",
            _read_bounded(layering, 120),
            f"### `{_rel(ctx.root, code_style)}`",
            "",
            _read_bounded(code_style, 80),
            f"### `{_rel(ctx.root, testing)}`",
            "",
            _read_bounded(testing, 120),
            f"### `{_rel(ctx.root, stack_tickets)}`",
            "",
            _read_bounded(stack_tickets, 80),
            "## Implementation checklist",
            "",
            _read_bounded(implementation, 70),
            "",
            "## Skills (read once each via Read; skip `reference.md` unless the ticket needs it)",
            "",
            "**Required for implementer:** `ponytail` and `caveman` at **full** "
            "(first two bullets). Policy: `factory/policy/ponytail.md`, "
            "`factory/policy/caveman.md` when `tools.*` is true.",
            "",
        ]
    )
    for skill in skill_paths:
        if skill.is_file():
            lines.append(f"- `{_rel(ctx.root, skill)}`")
    lines.append(f"- On-demand pack map: `{_rel(ctx.root, stack_skills)}`")
    lines.append(
        "- Load `safe-types-untrusted-input` and `strong-types-and-sanitizers` "
        "only when handling untrusted input or choosing types/sanitizers."
    )
    lines.append(
        "- Load `testing-code` / `unit-testing` children only when writing or "
        "changing tests beyond what `ticket-testing` already covers."
    )

    lines.extend(
        [
            "",
            "## Reading discipline",
            "",
            "- Graphify first when `tools.graphify` and the SESSION says so; "
            "then open only named paths.",
            "- Phase specs and program files: header or `rg` the id, then read "
            "≤120 lines per slice; do not load whole BINDING specs.",
            "- Do not re-read a file already covered here unless it changed.",
            "",
            "## Memory",
            "",
            f"Index: `{_rel(ctx.root, memory_index)}`. Data only; ranks below "
            "design and contract.",
            "",
        ]
    )
    if memory_note:
        lines.append(memory_note)

    lines.extend(
        [
            "",
            "## SESSION read list (from anexo; items 1–3 satisfied by this brief)",
            "",
            read_block or "(none)",
            "",
            f"Anexo: `{_rel(ctx.root, anexo)}`",
            "",
        ]
    )

    out_path.write_text("\n".join(lines), encoding="utf-8")
    return out_path
