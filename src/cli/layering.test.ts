import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { z } from '../index.ts';

const REPO = fileURLToPath(new URL('../..', import.meta.url));
const CONFIG = join(REPO, '.dependency-cruiser.cjs');
const CRUISER = join(
  REPO,
  'node_modules',
  'dependency-cruiser',
  'bin',
  'dependency-cruiser.mjs',
);

const Report = z.object({
  summary: z.object({
    violations: z.array(z.object({ rule: z.object({ name: z.string() }) })),
  }),
});

const roots: string[] = [];

after(async () => {
  await Promise.all(
    roots.map((root) => rm(root, { recursive: true, force: true })),
  );
});

/** A fixture tree under a temp dir, with the repo's cruiser config run against it. */
async function fixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'cli-layering-'));
  roots.push(root);
  await writeFile(join(root, 'tsconfig.json'), '{ "compilerOptions": {} }\n');
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), text);
  }
  return root;
}

/** The names of the rules the cruiser reports for `src/` under `root`. */
function violatedRules(root: string): string[] {
  const run = spawnSync(
    process.execPath,
    [CRUISER, '--config', CONFIG, '--output-type', 'json', 'src'],
    { cwd: root, encoding: 'utf8' },
  );
  const report = Report.safeParse(JSON.parse(run.stdout));
  assert.ok(report.success, run.stderr);
  return report.data.summary.violations.map((v) => v.rule.name);
}

const BASE = {
  'src/index.ts': 'export {};\n',
  'src/api/index.ts': 'export {};\n',
  'src/client/index.ts': 'export {};\n',
};

void test('V12: a cli file that imports client and the root is clean', async () => {
  const root = await fixture({
    ...BASE,
    'src/cli/index.ts': "import '../client/index.ts';\nimport '../index.ts';\n",
  });
  assert.deepEqual(violatedRules(root), []);
});

void test('V12: a cli file that imports api is refused by edge-cli', async () => {
  const root = await fixture({
    ...BASE,
    'src/cli/index.ts': "import '../api/index.ts';\n",
  });
  assert.ok(violatedRules(root).includes('edge-cli'));
});

void test('V12: a runtime file that imports cli is refused by edge-runtime', async () => {
  const root = await fixture({
    ...BASE,
    'src/cli/index.ts': 'export {};\n',
    'src/runtime/index.ts': "import '../cli/index.ts';\n",
  });
  assert.ok(violatedRules(root).includes('edge-runtime'));
});

void test('V12: layering.md has a row for api, client, and cli', async () => {
  const table = await readFile(
    join(REPO, 'factory/profile/layering.md'),
    'utf8',
  );
  for (const unit of ['api', 'client', 'cli']) {
    assert.ok(table.includes(`| \`${unit}\` |`), unit);
  }
});
