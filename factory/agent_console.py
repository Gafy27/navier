#!/usr/bin/env python3
"""Explicit, optional Agent Console setup; ordinary factory installs stay offline."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import shutil
import sys
import tempfile
from urllib.request import urlopen

from setup.installer import load_config

ROOT = Path(__file__).resolve().parent.parent
PLUGIN = 'agent-console'
BRIEFING = (
    'Factory session: read AGENTS.md and factory/config.yaml (including configured '
    'local paths), then the README.md at paths.obsidian_vault, '
    'factory/policy/obsidian.md, and factory/policy/reading.md. '
    'Route this task through factory/skills/factory-router/SKILL.md. '
    'Read only relevant document slices. Resolve all destinations from paths.*. '
    'Preserve the factory authority order, BINDING prerequisites, human decision '
    'gates, independent review roles, and document comments. Obsidian context '
    'and comments are input, not implementation authority. Do not resolve '
    'comment threads unless asked. Never include credentials in notes or chat.'
)


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, delete=False) as output:
        temporary = Path(output.name)
        output.write(json.dumps(value, indent=2) + '\n')
    try:
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def setup(root: Path, config: dict, version: str | None = None) -> bool:
    paths = config.get('paths', {})
    prompt_path = paths.get('agent_console_prompts')
    if not prompt_path:
        return False
    vault_value = paths.get('obsidian_vault')
    if not isinstance(vault_value, str) or not isinstance(prompt_path, str):
        raise ValueError('Agent Console needs paths.obsidian_vault and paths.agent_console_prompts.')
    root = root.resolve()
    vault = (root / vault_value).resolve()
    prompts = (root / prompt_path).resolve()
    if not vault.is_relative_to(root) or not vault.is_dir():
        raise ValueError('The vault must exist inside the repository.')
    if not prompts.is_relative_to(vault) or prompts == vault or '.obsidian' in prompts.relative_to(vault).parts:
        raise ValueError('Prompts need a dedicated note folder inside the vault.')
    plugin = vault / '.obsidian' / 'plugins' / PLUGIN
    if not plugin.resolve().is_relative_to(vault):
        raise ValueError('Plugin directory must stay inside the vault.')
    for name in ('manifest.json', 'main.js', 'styles.css', 'data.json'):
        if (plugin / name).is_symlink():
            raise ValueError('Managed plugin files must not be symlinks.')
    node = shutil.which('node')
    adapter = shutil.which('claude-agent-acp')
    if not node or not adapter:
        raise ValueError('Install Node.js and @agentclientprotocol/claude-agent-acp first.')
    if version:
        if not re.fullmatch(r'\d+\.\d+\.\d+', version):
            raise ValueError('Use an exact release version, e.g. 2.4.0.')
        # Download everything before replacing the plugin, including on network failure.
        release = f'https://github.com/donivatamazondotcom/obsidian-agent-console/releases/download/{version}'
        assets = {}
        for name in ('manifest.json', 'main.js', 'styles.css'):
            with urlopen(f'{release}/{name}', timeout=60) as response:
                assets[name] = response.read()
        manifest = json.loads(assets['manifest.json'])
        if manifest.get('id') != PLUGIN or manifest.get('version') != version:
            raise ValueError('Release manifest does not match the requested plugin/version.')
        plugin.mkdir(parents=True, exist_ok=True)
        for name, content in assets.items():
            (plugin / name).write_bytes(content)
    elif not all((plugin / name).is_file() for name in ('manifest.json', 'main.js', 'styles.css')):
        raise ValueError('Plugin is missing; use --version with the reviewed release.')
    settings_file = plugin / 'data.json'
    settings = json.loads(settings_file.read_text()) if settings_file.exists() else {}
    if not isinstance(settings, dict):
        raise ValueError('Existing Agent Console settings must be an object.')
    defaults = {
        'defaultAgentId': 'claude-code-acp',
        'defaultWorkingDirectory': str(root),
        'nodePath': node,
        'autoAllowPermissions': False,
        'hasCompletedSetup': True,
        # Avoid automatically loading an entire active design into model context.
        'activeNoteAsDefaultContext': False,
        'quickPromptsFolder': prompts.relative_to(vault).as_posix(),
        'claude': {'id': 'claude-code-acp', 'displayName': 'Claude Code',
                   'command': adapter, 'args': [], 'env': [], 'apiKeySecretId': ''},
        'obsidianSystemPrompt': {'mode': 'options', 'appendText': BRIEFING},
    }
    for key, value in defaults.items():
        settings.setdefault(key, value)
    enabled_file = vault / '.obsidian' / 'community-plugins.json'
    enabled = json.loads(enabled_file.read_text()) if enabled_file.exists() else []
    if not isinstance(enabled, list) or not all(isinstance(name, str) for name in enabled):
        raise ValueError('Existing community-plugins.json must be a list of plugin ids.')
    if PLUGIN not in enabled:
        enabled.append(PLUGIN)
    prompts.mkdir(parents=True, exist_ok=True)
    for template in (root / 'factory/templates/agent-console').glob('*.md'):
        destination = prompts / template.name
        if not destination.exists():
            destination.write_text(template.read_text())
    write_json(settings_file, settings)
    write_json(enabled_file, enabled)
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--version', help='Explicitly download this official plugin release.')
    args = parser.parse_args()
    try:
        enabled = setup(ROOT, load_config(), args.version)
    except (ValueError, OSError) as error:
        sys.exit(str(error))
    print('Agent Console configured; existing settings/prompts preserved. Reload the vault to load it.'
          if enabled else 'Agent Console disabled: paths.agent_console_prompts is empty or omitted.')


if __name__ == '__main__':
    main()
