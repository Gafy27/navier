#!/usr/bin/env python3
"""Scoped local Graphify queries and a small, disposable Obsidian code map."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from urllib.parse import quote

import yaml

_KIT_ROOT = Path(__file__).resolve().parent
if str(_KIT_ROOT) not in sys.path:
    sys.path.insert(0, str(_KIT_ROOT))

ROOT = _KIT_ROOT.parent
MANIFEST = '.graphify-managed.json'
FRONTMATTER = '---\ndoc_type: guide\ntopic: code-map\ntags: [generated/code-map, doc/guide, topic/code-map]\n---\n'


class Integration:
    def __init__(self, root: Path, config: dict):
        self.root = root.resolve()
        if not isinstance(config, dict) or not isinstance(config.get('paths', {}), dict) or not isinstance(config.get('tools', {}), dict):
            raise ValueError('Integration configuration, paths, and tools must be mappings.')
        paths = config.get('paths', {})
        if not paths.get('graphify_graph'):
            raise ValueError('Graphify integration is disabled; configure paths.graphify_graph first.')
        if not config.get('tools', {}).get('graphify'):
            raise ValueError('Enable tools.graphify first.')
        self.scan_root = self.local_path(paths.get('graphify_root', '.'), allow_root=True)
        self.graph_path = self.local_path(paths['graphify_graph'])
        if self.graph_path.suffix != '.json' or 'graphify-out' not in self.graph_path.parts or self.graph_path == self.root / 'graphify-out/graph.json':
            raise ValueError('Use a dedicated graphify-out/graph.json, separate from the legacy root graph.')
        self.notes = self.local_path(paths.get('graphify_notes'))
        vault = self.local_path(paths.get('obsidian_vault'))
        if not self.notes.is_relative_to(vault) or self.notes == vault:
            raise ValueError('paths.graphify_notes must be a dedicated folder inside the Obsidian vault.')
        sources = paths.get('graphify_sources')
        if not isinstance(sources, list) or not sources:
            raise ValueError('paths.graphify_sources must list source directories.')
        self.sources = [self.local_path(source) for source in sources]
        if any(not source.is_dir() or not source.is_relative_to(self.scan_root) for source in self.sources):
            raise ValueError('Every graphify_sources directory must exist inside graphify_root.')
        if any(self.notes.is_relative_to(source) or self.graph_path.is_relative_to(source) for source in self.sources):
            raise ValueError('Graph and notes outputs must be outside source directories.')

    def local_path(self, value, allow_root=False):
        if not isinstance(value, str) or not value.strip():
            raise ValueError('Required integration paths must be nonempty strings.')
        path = (self.root / value).resolve()
        if not path.is_relative_to(self.root) or (path == self.root and not allow_root):
            raise ValueError('Integration paths must stay inside the repository.')
        return path

    def source_path(self, value, repository_relative=False):
        if not isinstance(value, str):
            return None
        path = ((self.root if repository_relative else self.scan_root) / value).resolve()
        if not path.is_file() or not any(path.is_relative_to(source) for source in self.sources):
            return None
        return path.relative_to(self.root).as_posix()

    def scoped_graph(self, raw):
        if not isinstance(raw, dict) or not isinstance(raw.get('nodes'), list):
            raise ValueError('Invalid Graphify graph: expected a nodes list.')
        edges = raw.get('links', raw.get('edges'))
        if not isinstance(edges, list):
            raise ValueError('Invalid Graphify graph: expected links or edges list.')
        canonical_sources = raw.get('factory_scope') == 'repository-relative'
        nodes = []
        for node in raw['nodes']:
            if not isinstance(node, dict) or not isinstance(node.get('id'), str):
                raise ValueError('Invalid graph node.')
            source = self.source_path(node.get('source_file'), canonical_sources)
            if source:
                nodes.append({**node, 'source_file': source})
        ids = {node['id'] for node in nodes}
        if not nodes or len(ids) != len(nodes):
            raise ValueError('Scoped graph has no nodes or duplicate ids; previous outputs preserved.')
        links = []
        for edge in edges:
            if not isinstance(edge, dict) or not isinstance(edge.get('source'), str) or not isinstance(edge.get('target'), str):
                raise ValueError('Invalid graph edge endpoints.')
            if edge.get('source') not in ids or edge.get('target') not in ids:
                continue
            normalized = dict(edge)
            if 'source_file' in edge:
                source = self.source_path(edge['source_file'], canonical_sources)
                if not source:
                    continue
                normalized['source_file'] = source
            links.append(normalized)
        graph = {'directed': True, 'multigraph': True, 'graph': {},
                 'factory_scope': 'repository-relative',
                 'nodes': sorted(nodes, key=lambda node: node['id']),
                 'links': sorted(links, key=lambda edge: json.dumps(edge, sort_keys=True))}
        if 'factory_provenance' in raw:
            graph['factory_provenance'] = raw['factory_provenance']
        return graph

    def refresh(self):
        self.graph_path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='.extract-', dir=self.graph_path.parent) as staging:
            subprocess.run(['graphify', 'extract', str(self.scan_root), '--code-only', '--no-cluster',
                            '--max-workers', '4', '--out', staging], cwd=self.scan_root, check=True)
            graph = self.scoped_graph(json.loads((Path(staging) / 'graphify-out/graph.json').read_text()))
        digest = hashlib.sha256()
        files = sorted({node['source_file'] for node in graph['nodes']} |
                       {path.relative_to(self.root).as_posix() for source in self.sources
                        for path in source.rglob('*.rs') if self.source_path(str(path))})
        for name in files:
            digest.update(name.encode())
            digest.update((self.root / name).read_bytes())
        revision = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=self.root, capture_output=True, text=True)
        graph['factory_provenance'] = {'mode': 'local AST, code-only', 'sources': files,
                                       'source_sha256': digest.hexdigest(),
                                       'revision': revision.stdout.strip() if revision.returncode == 0 else 'unavailable'}
        self.export(graph, preflight=True)
        atomic_write(self.graph_path, json.dumps(graph, indent=2, sort_keys=True) + '\n')
        self.export(graph)

    def read_graph(self):
        if not self.graph_path.is_file():
            raise ValueError('Scoped graph is missing. Run commands.graphify_refresh first.')
        return self.scoped_graph(json.loads(self.graph_path.read_text()))

    def delegate(self, command, arguments):
        self.read_graph()
        subprocess.run(['graphify', command, *arguments, '--graph', str(self.graph_path)], cwd=self.scan_root, check=True)

    def export(self, graph=None, preflight=False):
        graph = graph if graph is not None else self.read_graph()
        units = {}
        for node in graph['nodes']:
            source = self.root / node['source_file']
            manifests = [parent / 'Cargo.toml' for parent in source.parents
                         if parent != self.root and parent.is_relative_to(self.root)]
            manifest = next((path for path in manifests if path.is_file()), None)
            if manifest:
                unit = manifest.parent.relative_to(self.root).as_posix()
                units.setdefault(unit, []).append(node)
        if not units:
            raise ValueError('No Rust crate manifests found for scoped graph; notes preserved.')
        names = {unit: 'unit-' + re.sub(r'[^a-zA-Z0-9_-]', '-', unit) + '.md' for unit in units}
        if len(set(names.values())) != len(names):
            raise ValueError('Unit filenames collide; notes preserved.')
        by_id = {node['id']: node for node in graph['nodes']}
        node_units = {node['id']: unit for unit, nodes in units.items() for node in nodes}
        provenance = graph.get('factory_provenance', {})
        freshness = ('Graph revision: ' + markdown(provenance.get('revision', 'unavailable')) + '\n\n'
                     'Source SHA-256: ' + markdown(provenance.get('source_sha256', 'unavailable')) + '\n\n')
        contents = {}
        for unit, nodes in sorted(units.items()):
            ids = {node['id'] for node in nodes}
            edges = [edge for edge in graph['links'] if edge['source'] in ids or edge['target'] in ids]
            lines = [FRONTMATTER, '# ' + markdown(unit), '',
                     'Generated from Graphify local AST extraction. Derived navigation; source and BINDING designs remain authoritative.', '',
                     freshness, f'{len(nodes)} symbols; {len(edges)} incident relationships.', '', '## Source files', '']
            for source in sorted({node['source_file'] for node in nodes}):
                lines.append('- ' + self.source_link(source))
            lines += ['', '## Connected units', '']
            neighbors = sorted({node_units.get(endpoint) for edge in edges for endpoint in (edge['source'], edge['target'])} - {None, unit})
            lines += ['- [[' + names[neighbor][:-3] + '|' + markdown(neighbor) + ']]' for neighbor in neighbors]
            lines += ['', '## Symbols (first 40)', '']
            for node in nodes[:40]:
                lines.append('- ' + markdown(node.get('label', node['id'])) + ' — ' + self.source_link(node['source_file'], node.get('source_location')))
            lines += ['', '## Relationships (first 40)', '',
                      'Confidence and origin are preserved from Graphify; AST edges are extracted, not semantic inference.', '']
            for edge in edges[:40]:
                lines.append('- ' + markdown(by_id[edge['source']].get('label', edge['source'])) + ' → ' +
                             markdown(by_id[edge['target']].get('label', edge['target'])) + ': ' + markdown(edge.get('relation', 'related')) +
                             ' (' + markdown(edge.get('confidence', 'unspecified')) + ', origin: ' + markdown(edge.get('_origin', 'unspecified')) + ')')
            contents[names[unit]] = '\n'.join(lines) + '\n'
        commands = ('Refresh: `python3 -B factory/graphify_obsidian.py refresh`\n\n'
                    'Export existing graph: `python3 -B factory/graphify_obsidian.py export`\n\n'
                    'Query: `python3 -B factory/graphify_obsidian.py query "your question"`\n\n')
        contents['README.md'] = FRONTMATTER + '# Code map\n\nGenerated crate summaries from local Graphify AST extraction. No LLM or API access.\n\n' + freshness + commands + '\n'.join('- [[' + names[unit][:-3] + '|' + markdown(unit) + ']]' for unit in sorted(units)) + '\n'
        owned = []
        manifest_path = self.notes / MANIFEST
        if manifest_path.is_symlink():
            raise ValueError('Generated-note manifest must be an ordinary file.')
        if manifest_path.exists():
            owned = json.loads(manifest_path.read_text())
            if not isinstance(owned, list) or any(not isinstance(name, str) or Path(name).name != name or not name.endswith('.md') for name in owned):
                raise ValueError('Invalid generated-note manifest; notes preserved.')
        for name in set(contents) | set(owned):
            destination = self.notes / name
            if destination.is_symlink() or (destination.exists() and not destination.is_file()):
                raise ValueError('Generated-note destination must be an ordinary file.')
            if name in contents and destination.exists() and name not in owned:
                raise ValueError(f'Unmanaged note collision: {name}; rename it before exporting.')
        if preflight:
            return
        self.notes.mkdir(parents=True, exist_ok=True)
        for name, body in contents.items():
            atomic_write(self.notes / name, body)
        for name in set(owned) - set(contents):
            (self.notes / name).unlink(missing_ok=True)
        atomic_write(manifest_path, json.dumps(sorted(contents), indent=2) + '\n')
        print(f'Exported {len(units)} unit notes to {self.notes.relative_to(self.root)}')

    def source_link(self, source, location=None):
        line = re.search(r'\d+', str(location or ''))
        suffix = ':L' + line.group() if line else ''
        target = quote(os.path.relpath(self.root / source, self.notes), safe='/')
        if line:
            target += '#L' + line.group()
        return '[' + markdown(source + suffix) + '](' + target + ')'


def markdown(value):
    return re.sub(r'([\\`*_{}\[\]<>|])', r'\\\1', str(value).replace('\n', ' ').replace('\r', ' '))


def atomic_write(path, content):
    if path.exists() and path.read_text() == content:
        return
    with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, delete=False) as temporary:
        temporary.write(content)
        temporary_path = Path(temporary.name)
    try:
        temporary_path.replace(path)
    finally:
        temporary_path.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['refresh', 'export', 'query', 'path', 'explain', 'god-nodes'])
    parser.add_argument('arguments', nargs='*')
    arguments = parser.parse_args()
    expected = {'refresh': 0, 'export': 0, 'query': 1, 'path': 2, 'explain': 1, 'god-nodes': 0}
    if len(arguments.arguments) != expected[arguments.command] or any(arg.startswith('-') for arg in arguments.arguments):
        parser.error('Wrong number of arguments; query/node arguments must not start with a dash.')
    from setup.installer import load_config
    try:
        integration = Integration(ROOT, load_config())
        if arguments.command == 'refresh':
            integration.refresh()
        elif arguments.command == 'export':
            integration.export()
        else:
            integration.delegate(arguments.command, arguments.arguments)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        parser.exit(1, f'Graphify integration: {error}\n')


if __name__ == '__main__':
    main()
