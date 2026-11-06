import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, test } from 'node:test';
import { createLogger, loadConfig } from '../../../index.ts';
import type { Logger, Result } from '../../../index.ts';
import {
  coreMigrations,
  migrate,
  parseOrgId,
  withTransaction,
} from '../../../db/index.ts';
import type { OrgId } from '../../../db/index.ts';
import {
  catalogMigrations,
  emptyCatalogConfig,
  registerTool,
} from '../../../catalog/index.ts';
import {
  AuthzConfigSchema,
  createAuthz,
  createAuthzAdmin,
  parsePrincipalId,
  PrincipalKind,
} from '../../../identity/index.ts';
import type { Authz, AuthzAdmin, ObjectRef } from '../../../identity/index.ts';
import { orgconfigMigrations, setOrgConfig } from '../../../orgconfig/index.ts';
import type { OrgLimits } from '../../../orgconfig/index.ts';
import type { ApiDeps } from '../../adapter/app.ts';
import { ApiConfigSchema } from '../../adapter/config.ts';
import type { ApiConfig } from '../../adapter/config.ts';
import { createIdpDirectory } from '../../adapter/idp-directory.ts';
import { IdpDirectoryConfigSchema } from '../../adapter/idp-directory-config.ts';
import type { ApiFailure } from '../../adapter/errors.ts';
import type { IdpDirectory } from '../../adapter/idp-directory.ts';
import { testCaller } from '../../../../test/support/caller.ts';
import { startFakeAuthz } from '../../../../test/support/fake-authz.ts';
import type {
  FakeAuthz,
  ObjectLike,
} from '../../../../test/support/fake-authz.ts';
import { createTestDatabase } from '../../../../test/support/stack.ts';
import type { TestDatabase } from '../../../../test/support/stack.ts';
import { submitGrants } from './grant-inputs.ts';
import type { ManageCheck } from './grant-inputs.ts';

const NAMESPACE = 'corp';
const SUFFIX = '@clients';
const PERSON = `user:${NAMESPACE}~P`;
const AGENT = 'agent:A~bot';
const ORG = 'A';

function unwrap<T>(r: { ok: true; value: T } | { ok: false }): T {
  if (!r.ok) throw new Error('unexpected err');
  return r.value;
}

const orgA = unwrap(parseOrgId(ORG));
const callerId = unwrap(parsePrincipalId(PERSON));
const caller = testCaller(
  { kind: PrincipalKind.person, id: callerId },
  `tok.${callerId}`,
);

const snapshot: OrgLimits = {
  maxToolsPerVersion: 11,
  maxFallbacks: 12,
  maxSteps: 13,
  pauseTimeout: '14h',
  maxTraceOutputBytes: 15,
  maxToolOutputBytes: 16,
  maxToolAttempts: 17,
};

interface Mock {
  readonly origin: string;
  readonly hits: string[];
  readonly close: () => Promise<void>;
}

function serve(userStatus = 200): Promise<Mock> {
  const hits: string[] = [];
  const server: Server = createServer((req, res) => {
    req.resume();
    const path = req.url ?? '';
    hits.push(path);
    if (path === '/token') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({ access_token: 'directory-token', expires_in: 120 }),
      );
      return;
    }
    res.writeHead(userStatus);
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

let database: TestDatabase;
let fake: FakeAuthz;
let admin: AuthzAdmin;
let authz: Authz;
let directory: IdpDirectory;
let mock: Mock;
let secretDir: string;
const log: Logger = createLogger('silent');

function userPaths(hits: readonly string[]): string[] {
  return hits.filter((path) => path.startsWith('/users/'));
}

function codeOf(r: Result<void, ApiFailure>): string {
  if (r.ok) return 'ok';
  return 'code' in r.error ? r.error.code : r.error.type;
}

function rpcs(): string[] {
  return fake.calls.map((call) => call.rpc);
}

function wrote(): boolean {
  return rpcs().includes('WriteGrants');
}

function checked(): { action: string; type: string; id: string }[] {
  const call = fake.calls.find((item) => item.rpc === 'Check');
  const request = call?.request as
    | {
        items?: {
          action: string;
          object: { type: string; id: string };
        }[];
      }
    | undefined;
  return (request?.items ?? []).map((item) => ({
    action: item.action,
    type: item.object.type,
    id: item.object.id,
  }));
}

function apiConfig(cap: number): ApiConfig {
  return unwrap(
    loadConfig(ApiConfigSchema, {
      API_HOST: '127.0.0.1',
      API_PORT: '9',
      API_BODY_MAX_BYTES: '1000',
      STREAM_READ_BATCH_SIZE: '10',
      IDP_DIRECTORY_LOOKUP_MAX: String(cap),
    }),
  );
}

function grantDeps(idp: IdpDirectory, cap: number, suffix?: string): ApiDeps {
  return {
    db: database.db,
    authzAdmin: admin,
    config: apiConfig(cap),
    log,
    idpDirectory: idp,
    principalNamespace: NAMESPACE,
    ...(suffix === undefined ? {} : { serviceSubjectSuffix: suffix }),
  } as ApiDeps;
}

function space(id: string): ObjectRef {
  return { type: 'space', id: `${ORG}~${id}` };
}

function allow(object: ObjectLike, privilege: string): void {
  fake.seedTuple(callerId, object, privilege);
}

function allowSpace(id: string): void {
  allow({ type: 'space', id: `${ORG}~${id}` }, 'editor');
}

function grant(
  object: ObjectRef,
  principal: string,
  privilege = 'member',
  change: 'writes' | 'deletes' = 'writes',
): {
  object: ObjectRef;
  writes?: { principal: string; privilege: string }[];
  deletes?: { principal: string; privilege: string }[];
} {
  const entry = [{ principal, privilege }];
  return change === 'writes'
    ? { object, writes: entry }
    : { object, deletes: entry };
}

function submit(
  inputs: Parameters<typeof submitGrants>[3],
  opts?: {
    readonly org?: OrgId;
    readonly cap?: number;
    readonly suffix?: string;
    readonly checks?: readonly ManageCheck[];
    readonly idp?: IdpDirectory;
  },
) {
  return submitGrants(
    grantDeps(opts?.idp ?? directory, opts?.cap ?? 8, opts?.suffix),
    caller,
    opts?.org ?? orgA,
    inputs,
    opts?.checks,
  );
}

before(async () => {
  database = await createTestDatabase();
  assert.equal(
    (
      await migrate(
        database.db,
        [...coreMigrations, ...catalogMigrations, ...orgconfigMigrations],
        log,
      )
    ).ok,
    true,
  );
  fake = await startFakeAuthz();
  secretDir = await mkdtemp(join(tmpdir(), 'grant-inputs-'));
  const secretFile = join(secretDir, 'secret');
  await writeFile(secretFile, 'client-secret-value\n');
  const authzConfig = unwrap(
    loadConfig(AuthzConfigSchema, {
      AUTHZ_API_URL: fake.url,
      AUTHZ_TLS: 'false',
      AUTHZ_TIMEOUT_MS: '3000',
      AUTHZ_CHECK_MAX_ITEMS: '10',
      AUTHZ_TOKEN_URL: fake.tokenUrl,
      AUTHZ_CLIENT_ID: 'svc',
      AUTHZ_CLIENT_SECRET_FILE: secretFile,
    }),
  );
  admin = createAuthzAdmin(authzConfig, log);
  authz = createAuthz(authzConfig, log);
  mock = await serve();
  const idpConfig = unwrap(
    loadConfig(IdpDirectoryConfigSchema, {
      NODE_ENV: 'test',
      IDP_DIRECTORY_USER_URL: `${mock.origin}/users/{subject}`,
      IDP_DIRECTORY_TOKEN_URL: `${mock.origin}/token`,
      IDP_DIRECTORY_CLIENT_ID: 'dir-client',
      IDP_DIRECTORY_CLIENT_SECRET_FILE: secretFile,
      IDP_DIRECTORY_TIMEOUT_MS: '1000',
    }),
  );
  directory = createIdpDirectory(idpConfig, log);
  await directory.userExists('warmup');
  mock.hits.length = 0;
});

after(async () => {
  await mock.close();
  await fake.close();
  await rm(secretDir, { recursive: true, force: true });
  await database.close();
});

beforeEach(() => {
  fake.clear();
  fake.calls.length = 0;
  fake.allowAll = true;
  fake.rejected.clear();
  mock.hits.length = 0;
});

void test('V7: a user in another namespace is invalid_argument and writes nothing', async () => {
  const wrong = 'user:wrongns~sub';
  const refused = await submit([grant(space('s1'), wrong)]);
  assert.equal(codeOf(refused), 'invalid_argument');
  assert.equal(refused.ok, false);
  assert.equal(refused.error.message.includes('wrongns'), false);
  assert.equal(refused.error.message.includes(wrong), false);
  assert.deepEqual(mock.hits, []);
  assert.equal(wrote(), false);

  allowSpace('s1');
  const subject = 'a|b';
  const accepted = await submit([
    grant(space('s1'), `user:${NAMESPACE}~${subject}`),
  ]);
  assert.equal(codeOf(accepted), 'ok');
  assert.deepEqual(userPaths(mock.hits), [
    `/users/${encodeURIComponent(subject)}`,
  ]);
  assert.equal(rpcs().filter((rpc) => rpc === 'WriteGrants').length, 1);
});

void test('V8: a denied manage check does not call the directory or write', async () => {
  fake.allowAll = false;
  const result = await submit([grant(space('s1'), PERSON)]);
  assert.equal(codeOf(result), 'permission_denied');
  assert.deepEqual(mock.hits, []);
  assert.equal(wrote(), false);
  assert.deepEqual(fake.tuplesOn(space('s1')), []);
});

void test('V9: a delete of a missing user skips the directory and writes', async () => {
  const missing = await serve(404);
  try {
    const idpConfig = unwrap(
      loadConfig(IdpDirectoryConfigSchema, {
        NODE_ENV: 'test',
        IDP_DIRECTORY_USER_URL: `${missing.origin}/users/{subject}`,
        IDP_DIRECTORY_TOKEN_URL: `${missing.origin}/token`,
        IDP_DIRECTORY_CLIENT_ID: 'dir-client',
        IDP_DIRECTORY_CLIENT_SECRET_FILE: join(secretDir, 'secret'),
        IDP_DIRECTORY_TIMEOUT_MS: '1000',
      }),
    );
    const idp = createIdpDirectory(idpConfig, log);
    allowSpace('s1');
    const result = await submit(
      [grant(space('s1'), 'user:corp~ghost', 'member', 'deletes')],
      { idp },
    );
    assert.equal(codeOf(result), 'ok');
    assert.deepEqual(missing.hits, []);
    assert.equal(wrote(), true);
  } finally {
    await missing.close();
  }
});

void test('V10: a suffix subject skips lookup; a plain subject does not', async () => {
  allowSpace('s1');
  const service = await submit(
    [grant(space('s1'), `user:${NAMESPACE}~svc${SUFFIX}`)],
    { suffix: SUFFIX },
  );
  assert.equal(codeOf(service), 'ok');
  assert.deepEqual(mock.hits, []);

  const person = await submit([grant(space('s1'), `user:${NAMESPACE}~alice`)], {
    suffix: SUFFIX,
  });
  assert.equal(codeOf(person), 'ok');
  assert.deepEqual(userPaths(mock.hits), ['/users/alice']);
});

void test('V11: the lookup cap counts distinct users and refuses before any call', async () => {
  allowSpace('s1');
  const users = ['one', 'two', 'three'].map(
    (subject) => `user:${NAMESPACE}~${subject}`,
  );
  const atCap = await submit(
    [
      {
        object: space('s1'),
        writes: users.slice(0, 2).map((principal) => ({
          principal,
          privilege: 'member',
        })),
      },
    ],
    { cap: 2 },
  );
  assert.equal(codeOf(atCap), 'ok');
  assert.deepEqual(userPaths(mock.hits), ['/users/one', '/users/two']);
  assert.equal(rpcs().filter((rpc) => rpc === 'WriteGrants').length, 1);

  mock.hits.length = 0;
  fake.calls.length = 0;
  const over = await submit(
    [
      {
        object: space('s1'),
        writes: users.map((principal) => ({
          principal,
          privilege: 'member',
        })),
      },
    ],
    { cap: 2 },
  );
  assert.equal(codeOf(over), 'invalid_argument');
  assert.deepEqual(mock.hits, []);
  assert.equal(wrote(), false);
});

void test('V12: a tool write needs a catalog row; a delete does not', async () => {
  fake.seed(callerId, orgA, 'org:config:admin');
  assert.equal(
    (await setOrgConfig(authz, database.db, caller, orgA, snapshot)).ok,
    true,
  );
  const tool: ObjectRef = { type: 'tool', id: `${ORG}~lookup` };
  allow(tool, 'owner');
  fake.calls.length = 0;

  const missing = await submit([grant(tool, AGENT, 'member')]);
  assert.equal(codeOf(missing), 'not_found');
  assert.equal(wrote(), false);
  assert.deepEqual(fake.tuplesOn(tool), [`${callerId}|owner`]);

  fake.calls.length = 0;
  const removed = await submit([grant(tool, AGENT, 'member', 'deletes')]);
  assert.equal(codeOf(removed), 'ok');
  assert.equal(wrote(), true);

  const registered = await withTransaction(database.db, (tx) =>
    registerTool(
      tx,
      emptyCatalogConfig,
      orgA,
      {
        key: 'lookup',
        implementationVersion: 1,
        name: 'Lookup',
        description: 'd',
        inputSchema: {},
        approval: 'never_ask',
      },
      caller.principal,
    ),
  );
  assert.equal(registered.ok, true);
  fake.calls.length = 0;
  const written = await submit([grant(tool, AGENT, 'member')]);
  assert.equal(codeOf(written), 'ok');
  assert.equal(wrote(), true);
  assert.ok(fake.tuplesOn(tool).includes(`${AGENT}|member`));
});

void test('V13: an unparseable tool id is invalid_argument before write', async () => {
  const tool: ObjectRef = { type: 'tool', id: `${ORG}~foo~bar` };
  const result = await submit([grant(tool, AGENT)]);
  assert.equal(codeOf(result), 'invalid_argument');
  assert.equal(result.ok, false);
  assert.equal(result.error.message.includes('foo'), false);
  assert.equal(wrote(), false);
});

void test('V14: a failure at any step stores no tuple', async () => {
  const object = space('s1');
  allowSpace('s1');

  const badPrincipal = await submit([grant(object, 'not-a-principal')]);
  assert.equal(codeOf(badPrincipal), 'invalid_argument');
  assert.deepEqual(rpcs(), []);
  assert.deepEqual(fake.tuplesOn(object), [`${callerId}|editor`]);

  fake.calls.length = 0;
  const otherOrg = await submit([grant(object, 'group:B~g1#member')]);
  assert.equal(codeOf(otherOrg), 'not_found');
  assert.equal(rpcs().includes('Check'), false);
  assert.equal(wrote(), false);

  fake.calls.length = 0;
  fake.allowAll = false;
  const denied = await submit([grant(object, PERSON)]);
  assert.equal(codeOf(denied), 'permission_denied');
  assert.deepEqual(mock.hits, []);
  assert.equal(wrote(), false);

  fake.allowAll = true;
  fake.calls.length = 0;
  const missingUser = await serve(404);
  try {
    const idp = createIdpDirectory(
      unwrap(
        loadConfig(IdpDirectoryConfigSchema, {
          NODE_ENV: 'test',
          IDP_DIRECTORY_USER_URL: `${missingUser.origin}/users/{subject}`,
          IDP_DIRECTORY_TOKEN_URL: `${missingUser.origin}/token`,
          IDP_DIRECTORY_CLIENT_ID: 'dir-client',
          IDP_DIRECTORY_CLIENT_SECRET_FILE: join(secretDir, 'secret'),
          IDP_DIRECTORY_TIMEOUT_MS: '1000',
        }),
      ),
      log,
    );
    const absent = await submit([grant(object, 'user:corp~ghost')], { idp });
    assert.equal(codeOf(absent), 'not_found');
    assert.ok(userPaths(missingUser.hits).length > 0);
    assert.equal(wrote(), false);
  } finally {
    await missingUser.close();
  }

  fake.calls.length = 0;
  const tool: ObjectRef = { type: 'tool', id: `${ORG}~absent` };
  allow(tool, 'owner');
  const noRow = await submit([grant(tool, AGENT)]);
  assert.equal(codeOf(noRow), 'not_found');
  assert.equal(wrote(), false);
  assert.deepEqual(
    fake.tuplesOn(tool).filter((row) => row.endsWith('|member')),
    [],
  );
});

void test('V15: directory create sends its manage row, not can_manage_grants', async () => {
  const org = unwrap(parseOrgId('n1'));
  const orgObject: ObjectRef = { type: 'organization', id: 'n1' };
  allow(orgObject, 'org_admin');
  const orgGrant = await submit(
    [grant(orgObject, 'agent:n1~bot', 'org_admin')],
    {
      org,
      checks: [{ object: orgObject, action: 'can_grant_org_admin' }],
    },
  );
  assert.equal(codeOf(orgGrant), 'ok');
  assert.deepEqual(checked(), [
    { action: 'can_grant_org_admin', type: 'organization', id: 'n1' },
  ]);

  fake.calls.length = 0;
  const bare = await submit([grant(orgObject, 'agent:n1~bot', 'org_admin')], {
    org,
  });
  assert.equal(checked()[0]?.action, 'can_manage_grants');
  assert.equal(codeOf(bare), 'ok');

  fake.calls.length = 0;
  allowSpace('s1');
  const spaceObject = space('s1');
  const spaceGrant = await submit([grant(spaceObject, AGENT)], {
    checks: [
      {
        object: { type: 'organization', id: ORG },
        action: 'can_self_grant_editor',
      },
    ],
  });
  assert.equal(codeOf(spaceGrant), 'ok');
  assert.deepEqual(checked(), [
    { action: 'can_self_grant_editor', type: 'organization', id: ORG },
  ]);

  fake.calls.length = 0;
  const groupObject: ObjectRef = { type: 'group', id: `${ORG}~g1` };
  allow(groupObject, 'member');
  const groupGrant = await submit([grant(groupObject, AGENT)], {
    checks: [
      { object: { type: 'organization', id: ORG }, action: 'can_grant_member' },
    ],
  });
  assert.equal(codeOf(groupGrant), 'ok');
  assert.deepEqual(checked(), [
    { action: 'can_grant_member', type: 'organization', id: ORG },
  ]);
});

void test('V20: an agent and a userset skip the directory', async () => {
  allowSpace('s1');
  const object = space('s1');
  for (const principal of [
    AGENT,
    'group:A~g1#member',
    'organization:A#member',
  ]) {
    mock.hits.length = 0;
    fake.calls.length = 0;
    const result = await submit([grant(object, principal)]);
    assert.equal(codeOf(result), 'ok', principal);
    assert.deepEqual(mock.hits, [], principal);
    assert.equal(wrote(), true, principal);
  }
});

void test('V21: a check transport failure is returned unchanged', async () => {
  fake.rejected.add(`tok.${callerId}`);
  const result = await submit([grant(space('s1'), PERSON)]);
  assert.equal(codeOf(result), 'unauthenticated');
  assert.equal(result.ok, false);
  assert.equal(result.error.message, 'authentication failed');
  assert.deepEqual(mock.hits, []);
  assert.equal(wrote(), false);
});

void test('V22: a claim-shaped subject still hits the directory unless the suffix matches', async () => {
  allowSpace('s1');
  const result = await submit(
    [grant(space('s1'), `user:${NAMESPACE}~client-credentials`)],
    { suffix: SUFFIX },
  );
  assert.equal(codeOf(result), 'ok');
  assert.deepEqual(userPaths(mock.hits), ['/users/client-credentials']);
});

void test('V23: default manage items are can_manage_grants in first-seen order', async () => {
  allowSpace('s1');
  allowSpace('s2');
  const first = space('s1');
  const second = space('s2');
  const result = await submit([grant(first, AGENT), grant(second, AGENT)]);
  assert.equal(codeOf(result), 'ok');
  assert.deepEqual(checked(), [
    { action: 'can_manage_grants', type: 'space', id: first.id },
    { action: 'can_manage_grants', type: 'space', id: second.id },
  ]);
  const names = rpcs();
  assert.ok(names.indexOf('Check') < names.indexOf('WriteGrants'));
});

void test('V24: one user named twice is one directory call', async () => {
  allowSpace('s1');
  const principal = `user:${NAMESPACE}~twice`;
  const result = await submit([
    {
      object: space('s1'),
      writes: [
        { principal, privilege: 'member' },
        { principal, privilege: 'editor' },
      ],
    },
  ]);
  assert.equal(codeOf(result), 'ok');
  assert.deepEqual(userPaths(mock.hits), ['/users/twice']);
  assert.equal(rpcs().filter((rpc) => rpc === 'WriteGrants').length, 1);
});

void test('V25: the first deny wins and later probes do not run', async () => {
  fake.allowAll = false;
  const first = space('s1');
  const second = space('s2');
  const inputs = [grant(first, PERSON), grant(second, PERSON)];
  const manage = 'manage_grants';

  allow(second, manage);
  const leadDeny = await submit(inputs);
  assert.equal(codeOf(leadDeny), 'permission_denied');
  assert.deepEqual(mock.hits, []);
  assert.equal(wrote(), false);

  fake.clear();
  fake.calls.length = 0;
  mock.hits.length = 0;
  fake.allowAll = false;
  allow(first, manage);
  const tailDeny = await submit(inputs);
  assert.equal(codeOf(tailDeny), 'permission_denied');
  assert.deepEqual(mock.hits, []);
  assert.equal(wrote(), false);
});
