"""Click commands for setup, check, and install."""

from __future__ import annotations

from pathlib import Path

import click

from setup import installer
from setup.context import InstallContext, default_project_root, resolve_context
from setup.readiness import detect_facts, readiness
from setup.session_brief import bundle_all_sessions, bundle_session

KIT_ROOT = Path(__file__).resolve().parent.parent
ENTRY_SCRIPT = KIT_ROOT / "cli.py"


def _resolve(root: Path | None, kit: Path | None) -> InstallContext:
    try:
        return resolve_context(root=root, kit=kit, script=ENTRY_SCRIPT)
    except ValueError as error:
        raise click.ClickException(str(error)) from error


def render_prompt(root: Path) -> str:
    """Kickoff prompt always names `<root>/factory` as the target kit location."""
    source = KIT_ROOT / "templates/PROFILE_SETUP_PROMPT.md"
    template = source.read_text()
    return template.replace("{{PROJECT_ROOT}}", str(root)).replace(
        "{{FACTORY_ROOT}}", str(root / "factory")
    )


def shared_root_option():
    return click.option(
        "--root",
        "project_root",
        type=click.Path(path_type=Path, file_okay=False),
        default=lambda: default_project_root(script=ENTRY_SCRIPT),
        show_default="detected project root",
    )


def shared_kit_option():
    return click.option(
        "--kit",
        "kit_path",
        type=click.Path(path_type=Path, file_okay=True),
        default=None,
        help="Directory containing config.yaml (default: <root>/factory or this kit).",
    )


@click.group()
def cli() -> None:
    """Configure and install the Factory kit into a host repository."""


@cli.command()
@shared_root_option()
@shared_kit_option()
@click.option(
    "--output",
    type=click.Path(path_type=Path, dir_okay=False),
    help="Save the kickoff prompt here; existing files are never overwritten.",
)
def setup(project_root: Path, kit_path: Path | None, output: Path | None) -> None:
    """Inspect a project and show setup stages plus a copyable agent prompt."""
    root = project_root.resolve()
    try:
        ctx = _resolve(project_root, kit_path)
    except click.ClickException:
        ctx = InstallContext(root=root, kit=root / "factory")
    click.echo(f"Project root: {ctx.root}")
    click.echo(f"Factory kit: {ctx.kit}")
    click.echo("Detected markers (facts only):")
    facts = detect_facts(ctx.root)
    click.echo("\n".join(f"  - {fact}" for fact in facts) if facts else "  - none found")
    click.echo("\nSetup stages:")
    for stage in (
        "1. Inspect project evidence; separate facts from unknowns.",
        "2. Configure factory/config.yaml paths, commands, language, and tools.",
        "3. Fill the nine profile documents, including project testing recipes.",
        "4. Run `python3 <kit>/cli.py check --root <project>` until ready.",
        "5. Run `python3 <kit>/cli.py install --root <project>` to install explicitly.",
        "6. Ask your agent to execute a profile testing journey; report runtime verification separately.",
    ):
        click.echo(f"  {stage}")
    click.echo("\nMissing requirements:")
    _, problems = readiness(ctx, installer)
    click.echo("\n".join(f"  - {problem}" for problem in problems) if problems else "  - none detected")
    click.echo("\nCopyable agent kickoff prompt:\n")
    prompt = render_prompt(ctx.root)
    click.echo(prompt)
    if output is not None:
        destination = output if output.is_absolute() else Path.cwd() / output
        try:
            destination.parent.mkdir(parents=True, exist_ok=True)
            with destination.open("x") as handle:
                handle.write(prompt)
        except FileExistsError:
            raise click.ClickException(
                f"Refusing to overwrite existing prompt: {destination}"
            ) from None
        click.echo(f"Saved prompt: {destination.resolve()}")


@cli.command()
@shared_root_option()
@shared_kit_option()
def check(project_root: Path, kit_path: Path | None) -> None:
    """Check setup prerequisites; does not install or verify runtime behavior."""
    ctx = _resolve(project_root, kit_path)
    _, problems = readiness(ctx, installer)
    if problems:
        for problem in problems:
            click.echo(f"ERROR: {problem}", err=True)
        raise click.ClickException(
            "Factory is not ready. Fix the listed requirements and run check again."
        )
    click.echo("Factory configuration and profile are structurally ready.")
    click.echo("State: configured; runtime behavior remains unverified.")


@cli.command("bundle-session")
@shared_root_option()
@shared_kit_option()
@click.option(
    "--anexo",
    required=True,
    type=click.Path(path_type=Path, dir_okay=False, exists=True),
    help="Path to *_TICKETS.md",
)
@click.option(
    "--session",
    "session_num",
    type=int,
    default=None,
    help="SESSION number (integer from ## SESSION N heading)",
)
@click.option(
    "--all",
    "all_sessions",
    is_flag=True,
    help="Write a brief for every ## SESSION in the anexo (anexo pass / refresh)",
)
def bundle_session_cmd(
    project_root: Path,
    kit_path: Path | None,
    anexo: Path,
    session_num: int | None,
    all_sessions: bool,
) -> None:
    """Write paths.runs/<anexo-stem>/ticket-N-brief.md for implementer bootstrap."""
    if all_sessions and session_num is not None:
        raise click.ClickException("Use --session N or --all, not both")
    if not all_sessions and session_num is None:
        raise click.ClickException("Pass --session N or --all")
    ctx = _resolve(project_root, kit_path)
    if anexo.is_absolute():
        anexo_path = anexo.resolve()
    else:
        candidate = (ctx.root / anexo).resolve()
        anexo_path = candidate if candidate.is_file() else (Path.cwd() / anexo).resolve()
    try:
        if all_sessions:
            outs = bundle_all_sessions(ctx, anexo=anexo_path)
            for path in outs:
                click.echo(path.resolve())
        else:
            out = bundle_session(ctx, anexo=anexo_path, session=session_num)
            click.echo(out.resolve())
    except ValueError as error:
        raise click.ClickException(str(error)) from error


@cli.command()
@shared_root_option()
@shared_kit_option()
def install(project_root: Path, kit_path: Path | None) -> None:
    """Install into the host repo after readiness checks pass."""
    ctx = _resolve(project_root, kit_path)
    _, problems = readiness(ctx, installer)
    if problems:
        for problem in problems:
            click.echo(f"ERROR: {problem}", err=True)
        raise click.ClickException(
            "Install stopped because setup requirements are incomplete."
        )
    installer.run_install(ctx)
    click.echo("State: installed; runtime behavior remains unverified.")


def main() -> None:
    import sys

    argv = sys.argv[1:]
    if not argv:
        argv = ["install"]
    elif argv[0].startswith("-") and argv[0] not in ("-h", "--help"):
        argv = ["install", *argv]
    elif argv[0] not in ("setup", "check", "install", "bundle-session"):
        argv = ["install", *argv]
    cli(argv, prog_name="factory/cli.py", standalone_mode=True)
