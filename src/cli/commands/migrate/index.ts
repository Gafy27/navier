import type { Command } from 'commander';
import { z } from '../../../index.ts';
import type { CliContext, CliEnv } from '../../utils/context.ts';
import { EXIT_OK } from '../../utils/constants.ts';
import { CliFailure } from '../../utils/failure.ts';
import { childEnv, requireDeskProject } from '../../utils/server-config.ts';

export const MigrateToken = z.enum({
  command: 'migrate',
  entry: 'src/migrate.ts',
  checkFlag: '--check',
});

const MigrateMessage = z.enum({
  description: 'apply database migrations to the attached database',
});

/** The running Node binary: the child env carries no PATH to look one up. */
export const NODE_BINARY = process.execPath;
/** `src/migrate.ts --check` exits 2 on a bad config or a connection error. */
export const MIGRATE_ERROR_EXIT = 2;

function migrateExited(code: number): string {
  return `migrate exited with ${String(code)}`;
}

export async function runMigrate(env: CliEnv): Promise<void> {
  const files = await requireDeskProject(env.projectDir);
  const child = env.spawn(NODE_BINARY, [MigrateToken.enum.entry], {
    env: childEnv(files),
    cwd: env.projectDir,
  });
  for await (const line of child.lines) env.io.stdout(`${line}\n`);
  const code = await child.exited;
  if (code !== EXIT_OK) throw new CliFailure(migrateExited(code));
}

export function registerMigrate(program: Command, ctx: CliContext): void {
  program
    .command(MigrateToken.enum.command)
    .description(MigrateMessage.enum.description)
    .action(async () => {
      await runMigrate(ctx.env);
    });
}
