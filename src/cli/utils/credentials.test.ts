import assert from 'node:assert/strict';
import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { CREDENTIALS_FILE_NAME } from './constants.ts';
import { AuthKind, createCredentialsStore } from './credentials.ts';
import type { Credentials } from './credentials.ts';
import { CliFailure } from './failure.ts';

const roots: string[] = [];

after(async () => {
  await Promise.all(
    roots.map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'cli-credentials-'));
  roots.push(dir);
  return dir;
}

const PERSON: Credentials = {
  baseUrl: 'http://api.test',
  auth: { kind: AuthKind.enum.person, session: 'ses_secret' },
  org: 'desk',
};

void test('V6a: write creates credentials.json with mode 0600', async () => {
  const dir = await tempDir();
  await createCredentialsStore(dir).write(PERSON);
  const info = await stat(join(dir, CREDENTIALS_FILE_NAME));
  assert.equal(info.mode & 0o777, 0o600);
});

void test('V6b: a second write replaces the file and leaves no temp file', async () => {
  const dir = await tempDir();
  const store = createCredentialsStore(dir);
  await store.write(PERSON);
  await store.write({ ...PERSON, space: 'support' });
  assert.deepEqual(await readdir(dir), [CREDENTIALS_FILE_NAME]);
  assert.equal((await store.read())?.space, 'support');
});

void test('V6c: a file readable by group or other is refused without its text', async () => {
  const dir = await tempDir();
  const store = createCredentialsStore(dir);
  await store.write(PERSON);
  await chmod(join(dir, CREDENTIALS_FILE_NAME), 0o644);
  await assert.rejects(store.read(), (cause: unknown) => {
    assert.ok(cause instanceof CliFailure);
    assert.ok(!cause.message.includes('ses_secret'));
    return true;
  });
});

void test('V6d: mode 0600 reads back what was written', async () => {
  const dir = await tempDir();
  const store = createCredentialsStore(dir);
  await store.write(PERSON);
  await chmod(join(dir, CREDENTIALS_FILE_NAME), 0o600);
  assert.deepEqual(await store.read(), PERSON);
});

void test('V6e and V6f: an extra key or a missing auth is refused', async () => {
  const dir = await tempDir();
  const store = createCredentialsStore(dir);
  const file = join(dir, CREDENTIALS_FILE_NAME);
  await writeFile(file, JSON.stringify({ ...PERSON, extra: 1 }), {
    mode: 0o600,
  });
  await assert.rejects(store.read(), CliFailure);
  await writeFile(file, JSON.stringify({ baseUrl: 'http://api.test' }), {
    mode: 0o600,
  });
  await assert.rejects(store.read(), CliFailure);
});

void test('V6g: a file under profiles/ is never read', async () => {
  const dir = await tempDir();
  await mkdir(join(dir, 'profiles'));
  await writeFile(join(dir, 'profiles', 'x.json'), JSON.stringify(PERSON), {
    mode: 0o600,
  });
  assert.equal(await createCredentialsStore(dir).read(), undefined);
});

void test('V6h: remove deletes the file, and read then returns undefined', async () => {
  const dir = await tempDir();
  const store = createCredentialsStore(dir);
  await store.write(PERSON);
  await store.remove();
  assert.equal(await store.read(), undefined);
  await store.remove();
});
