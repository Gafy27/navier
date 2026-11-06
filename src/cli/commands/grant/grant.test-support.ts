import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { z } from '../../../index.ts';
import { createContext } from '../../index.ts';
import type { CliContext, CliEnv } from '../../utils/context.ts';
import { AuthKind } from '../../utils/credentials.ts';
import { noTtyPrompter } from '../../utils/prompts.ts';
import type { Prompter } from '../../utils/prompts.ts';

/** Fixture values for the grant and model command tests. */
export const Fake = z.enum({
  base: 'http://api.test',
  mePath: '/api/v1/auth/me',
  session: 'ses_grant-never-printed',
  org: 'acme',
  me: 'user:ns~owner',
  loopback: '127.0.0.1',
  dirPrefix: 'cli-cmd-',
  get: 'GET',
});

export interface Sent {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}

/** A path answer: a JSON body, or a status with a wire error. */
export type Reply =
  | { readonly json: unknown }
  | {
      readonly status: number;
      readonly error: { readonly type: string; readonly message: string };
    };

export interface Harness {
  readonly ctx: CliContext;
  readonly env: CliEnv;
  readonly sent: Sent[];
  readonly out: () => string;
}

/** A signed-in person with `org` in context, a TTY flag, and a fake API answering by `reply`. */
export async function harness(
  t: TestContext,
  options: {
    readonly reply: (sent: Sent) => Reply;
    readonly prompter?: Prompter;
    readonly tty?: boolean;
    readonly contextOrg?: boolean;
  },
): Promise<Harness> {
  const dir = await mkdtemp(join(tmpdir(), Fake.enum.dirPrefix));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const sent: Sent[] = [];
  let out = '';
  const env: CliEnv = {
    configDir: dir,
    projectDir: dir,
    vars: {},
    loopbackHost: Fake.enum.loopback,
    fetch: async (input, init) => {
      const request = new Request(input, init);
      const text = request.method === Fake.enum.get ? '' : await request.text();
      const record: Sent = {
        method: request.method,
        path: new URL(request.url).pathname,
        body: text.length === 0 ? undefined : (JSON.parse(text) as unknown),
      };
      sent.push(record);
      if (record.path === Fake.enum.mePath) {
        return Response.json({
          principal: Fake.enum.me,
          kind: AuthKind.enum.person,
        });
      }
      const reply = options.reply(record);
      return 'json' in reply
        ? Response.json(reply.json)
        : Response.json({ error: reply.error }, { status: reply.status });
    },
    io: {
      stdout: (s) => {
        out += s;
      },
      stderr: () => undefined,
      stdin: () => Promise.resolve(''),
      isTTY: options.tty ?? true,
    },
    prompter: options.prompter ?? noTtyPrompter(),
    open: () => undefined,
    listen: () => Promise.reject(new Error('listen not scripted')),
    spawn: () => {
      throw new Error('spawn not scripted');
    },
    readFile: () => Promise.reject(new Error('readFile not scripted')),
  };
  const ctx = createContext(env);
  await ctx.credentials.write({
    baseUrl: Fake.enum.base,
    auth: { kind: AuthKind.enum.person, session: Fake.enum.session },
    ...(options.contextOrg === false ? {} : { org: Fake.enum.org }),
  });
  return { ctx, env, sent, out: () => out };
}
