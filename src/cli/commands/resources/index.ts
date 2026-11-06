import type { Command } from 'commander';
import type { CliContext } from '../../utils/context.ts';
import { defineLeaf } from '../../utils/leaf.ts';
import { LEAVES } from './leaves.ts';

export function registerResources(program: Command, ctx: CliContext): void {
  for (const leaf of LEAVES) defineLeaf(program, leaf, ctx);
}
