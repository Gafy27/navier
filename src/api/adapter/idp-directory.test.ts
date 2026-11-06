import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { createLogger, loadConfig } from '../../index.ts';
import type { Logger } from '../../index.ts';
import { createIdpDirectory } from './idp-directory.ts';
import { IdpDirectoryConfigSchema } from './idp-directory-config.ts';
import type { IdpDirectoryConfig } from './idp-directory-config.ts';

const SECRET = 'directory-secret';
const TOKEN = 'directory-token';
const dir = mkdtempSync(join(tmpdir(), 'idp-dir-'));
const secretFile = join(dir, 'secret');
writeFileSync(secretFile, `${SECRET}\n`);
after(() => {
  rmSync(dir, { recursive: true, force: true });
});

interface Mock {
  readonly userStatus?: number;
  readonly tokenStatus?: number;
  readonly tokenJson?: unknown;
  readonly hangUser?: boolean;
}

function serve(opts: Mock): Promise<{
  origin: string;
  hits: string[];
  close: () => Promise<void>;
}> {
  const hits: string[] = [];
  const server: Server = createServer((req, res) => {
    req.resume();
    const path = req.url ?? '';
    hits.push(path);
    if (path === '/token') {
      const status = opts.tokenStatus ?? 200;
      const body =
        opts.tokenJson === undefined
          ? { access_token: TOKEN, expires_in: 120 }
          : opts.tokenJson;
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(status === 200 ? JSON.stringify(body) : '');
      return;
    }
    if (opts.hangUser === true) return;
    res.writeHead(opts.userStatus ?? 200);
    res.end();
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr === null || typeof addr === 'string') {
        throw new Error('directory mock has no port');
      }
      resolve({
        origin: `http://127.0.0.1:${String(addr.port)}`,
        hits,
        close: () =>
          new Promise((done, reject) => {
            server.closeAllConnections();
            server.close((error) => {
              if (error) reject(error);
              else done();
            });
          }),
      });
    });
  });
}

function capture(): { readonly lines: string[]; readonly log: Logger } {
  const lines: string[] = [];
  const log = createLogger('info', {
    write: (line: string) => {
      lines.push(line);
    },
  });
  return { lines, log };
}

function config(origin: string, timeoutMs: number): IdpDirectoryConfig {
  const loaded = loadConfig(IdpDirectoryConfigSchema, {
    NODE_ENV: 'test',
    IDP_DIRECTORY_USER_URL: `${origin}/users/{subject}`,
    IDP_DIRECTORY_TOKEN_URL: `${origin}/token`,
    IDP_DIRECTORY_CLIENT_ID: 'dir-client',
    IDP_DIRECTORY_CLIENT_SECRET_FILE: secretFile,
    IDP_DIRECTORY_TIMEOUT_MS: String(timeoutMs),
  });
  assert.ok(loaded.ok);
  return loaded.value;
}

function assertClean(
  lines: readonly string[],
  message: string,
  subject: string,
) {
  const text = `${message}\n${lines.join('\n')}`;
  assert.equal(text.includes(subject), false);
  assert.equal(text.includes(encodeURIComponent(subject)), false);
  assert.equal(text.includes(SECRET), false);
  assert.equal(text.includes(TOKEN), false);
  assert.equal(text.toLowerCase().includes('authorization'), false);
}

void test('V6: 200 encodes the subject and does not log the token', async () => {
  const subject = 'user|sub';
  const mock = await serve({});
  const { lines, log } = capture();
  try {
    const found = await createIdpDirectory(
      config(mock.origin, 1000),
      log,
    ).userExists(subject);
    assert.equal(found.ok, true);
    assert.deepEqual(mock.hits, [
      '/token',
      `/users/${encodeURIComponent(subject)}`,
    ]);
    assertClean(lines, '', subject);
  } finally {
    await mock.close();
  }
});

void test('V6: 404 is not found and the message has no subject', async () => {
  const subject = 'missing|user';
  const mock = await serve({ userStatus: 404 });
  const { lines, log } = capture();
  try {
    const found = await createIdpDirectory(
      config(mock.origin, 1000),
      log,
    ).userExists(subject);
    assert.ok(!found.ok && 'code' in found.error);
    assert.equal(found.error.code, 'not_found');
    assert.equal(found.error.message, 'not found');
    assertClean(lines, found.error.message, subject);
    assert.match(lines.join('\n'), /"status":404/);
  } finally {
    await mock.close();
  }
});

void test('V6: 500 is unavailable and the log has status only', async () => {
  const subject = 'down|user';
  const mock = await serve({ userStatus: 500 });
  const { lines, log } = capture();
  try {
    const found = await createIdpDirectory(
      config(mock.origin, 1000),
      log,
    ).userExists(subject);
    assert.ok(!found.ok && 'code' in found.error);
    assert.equal(found.error.code, 'unavailable');
    assert.equal(found.error.message, 'identity provider unavailable');
    assertClean(lines, found.error.message, subject);
    assert.match(lines.join('\n'), /"status":500/);
  } finally {
    await mock.close();
  }
});

void test('V6: a 401 token response never calls the user URL', async () => {
  const subject = 'refused|user';
  const mock = await serve({ tokenStatus: 401 });
  const { lines, log } = capture();
  try {
    const found = await createIdpDirectory(
      config(mock.origin, 1000),
      log,
    ).userExists(subject);
    assert.equal(found.ok, false);
    assert.equal(found.error.message, 'identity provider unavailable');
    assert.deepEqual(mock.hits, ['/token']);
    assertClean(lines, found.error.message, subject);
  } finally {
    await mock.close();
  }
});

void test('V6: a malformed token is undefined and never calls the user URL', async () => {
  const subject = 'malformed|user';
  const mock = await serve({ tokenJson: { access_token: TOKEN } });
  const { lines, log } = capture();
  try {
    const found = await createIdpDirectory(
      config(mock.origin, 1000),
      log,
    ).userExists(subject);
    assert.equal(found.ok, false);
    assert.equal(found.error.message, 'identity provider unavailable');
    assert.deepEqual(mock.hits, ['/token']);
    assertClean(lines, found.error.message, subject);
  } finally {
    await mock.close();
  }
});

void test('V6: a hung user lookup times out without the subject in the log', async () => {
  const subject = 'hung|user';
  const mock = await serve({ hangUser: true });
  const { lines, log } = capture();
  try {
    const found = await createIdpDirectory(
      config(mock.origin, 50),
      log,
    ).userExists(subject);
    assert.equal(found.ok, false);
    assert.equal(found.error.message, 'identity provider unavailable');
    assert.deepEqual(mock.hits, [
      '/token',
      `/users/${encodeURIComponent(subject)}`,
    ]);
    assertClean(lines, found.error.message, subject);
  } finally {
    await mock.close();
  }
});
