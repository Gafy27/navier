import type { Command } from 'commander';
import { createClient, WireType } from '../../../client/index.ts';
import { z } from '../../../index.ts';
import type { CliContext } from '../../utils/context.ts';
import type { Credentials } from '../../utils/credentials.ts';
import { CliFailure, CliUsage } from '../../utils/failure.ts';
import {
  BASE_URL_VAR,
  CLIENT_ID_VAR,
  CLIENT_SECRET_VAR,
  ISSUER_VAR,
} from '../../env-keys.ts';
import { loginDeps, runLogin } from './login.ts';

const Me = z.object({ principal: z.string(), kind: z.string() });

/** Ends the old person session. A dead session (`unauthenticated`) continues into login; any other logout failure leaves the file unchanged (PD4). */
async function endOldSession(
  ctx: CliContext,
  old: Credentials | undefined,
): Promise<void> {
  if (old?.auth.kind !== 'person') return;
  const { session } = old.auth;
  const client = createClient({
    baseUrl: old.baseUrl,
    credential: () => session,
    fetch: ctx.env.fetch,
  });
  const result = await client.logout({});
  if (!result.ok && result.error.type !== WireType.enum.unauthenticated) {
    throw new CliFailure(`logout failed: ${result.error.type}`);
  }
}

async function login(ctx: CliContext, url: string | undefined): Promise<void> {
  const old = await ctx.credentials.read();
  const baseUrl =
    url ??
    old?.baseUrl ??
    (await ctx.env.prompter.text({ message: 'Server URL', flag: 'url' }));
  await endOldSession(ctx, old);
  await runLogin(
    loginDeps(ctx.env),
    ctx.credentials,
    baseUrl,
    ctx.env.loopbackHost,
  );
}

/** An env var first; else a prompt on a TTY; else a usage error naming the var (D3). */
async function field(
  ctx: CliContext,
  name: string,
  ask: () => Promise<string>,
): Promise<string> {
  const given = ctx.env.vars[name];
  if (given !== undefined && given !== '') return given;
  if (!ctx.env.io.isTTY) throw new CliUsage(`missing ${name}`);
  return ask();
}

async function addService(ctx: CliContext): Promise<void> {
  const { prompter } = ctx.env;
  const baseUrl = await field(ctx, BASE_URL_VAR, () =>
    prompter.text({ message: 'Server URL', flag: 'url' }),
  );
  const issuer = await field(ctx, ISSUER_VAR, () =>
    prompter.text({ message: 'Issuer URL', flag: 'issuer' }),
  );
  const clientId = await field(ctx, CLIENT_ID_VAR, () =>
    prompter.text({ message: 'Client id', flag: 'client-id' }),
  );
  const clientSecret = await field(ctx, CLIENT_SECRET_VAR, () =>
    prompter.password({ message: 'Client secret', flag: 'client-secret' }),
  );
  await ctx.credentials.write({
    baseUrl,
    auth: { kind: 'service', issuer, clientId, clientSecret },
  });
}

/** Removes the file only when the server call succeeds (PD4). */
async function logout(ctx: CliContext): Promise<void> {
  const result = await ctx.call('logout', {});
  if (!result.ok) throw new CliFailure(`logout failed: ${result.error.type}`);
  await ctx.credentials.remove();
}

/** Prints the principal and kind only (G6). */
async function whoami(ctx: CliContext): Promise<void> {
  const result = await ctx.call('me', {});
  if (!result.ok) throw new CliFailure(`whoami failed: ${result.error.type}`);
  const me = Me.parse(result.value);
  ctx.env.io.stdout(`principal: ${me.principal}\nkind: ${me.kind}\n`);
}

export function registerAuth(program: Command, ctx: CliContext): void {
  const signIn = program
    .command('login')
    .description('sign in through the browser')
    .option('--url <url>', 'server base URL')
    .action(async (options: { readonly url?: string }) => {
      await login(ctx, options.url);
    });
  signIn
    .command('add-service')
    .description('store a service client in place of a person session')
    .action(async () => {
      await addService(ctx);
    });
  program
    .command('logout')
    .description('end the session and remove the credentials file')
    .action(async () => {
      await logout(ctx);
    });
  program
    .command('whoami')
    .description('print the signed-in principal')
    .action(async () => {
      await whoami(ctx);
    });
}
