import * as clack from '@clack/prompts';
import {
  PROMPT_CANCELLED,
  PROMPT_NOT_AN_OPTION,
  usageMissingFlag,
} from './copy.ts';
import { CliFailure, CliUsage } from './failure.ts';

interface Question {
  readonly message: string;
  /** The flag that answers this question without a prompt. */
  readonly flag: string;
}

interface Choice<T extends string> extends Question {
  readonly options: readonly { readonly value: T; readonly label: string }[];
}

/** The one seam every command asks through (PD3). */
export interface Prompter {
  readonly text: (q: Question) => Promise<string>;
  readonly password: (q: Question) => Promise<string>;
  readonly select: <T extends string>(q: Choice<T>) => Promise<T>;
  readonly multiselect: <T extends string>(
    q: Choice<T>,
  ) => Promise<readonly T[]>;
  readonly confirm: (q: Question) => Promise<boolean>;
}

/** A cancelled prompt (Ctrl-C) is a failure, not an empty answer. */
function answered<V>(value: V): Exclude<V, symbol> {
  if (!isAnswer(value)) throw new CliFailure(PROMPT_CANCELLED);
  return value;
}

function isAnswer<V>(value: V): value is Exclude<V, symbol> {
  return typeof value !== 'symbol';
}

/** Maps a clack answer back to the caller's own option values. */
function chosen<T extends string>(choice: Choice<T>, pick: string): T {
  const option = choice.options.find((o) => o.value === pick);
  if (option === undefined) throw new CliFailure(PROMPT_NOT_AN_OPTION);
  return option.value;
}

function labelled(choice: Choice<string>): { value: string; label: string }[] {
  return choice.options.map(({ value, label }) => ({ value, label }));
}

/** Prompts on a TTY with `@clack/prompts`. This file is the only importer of it. */
export function clackPrompter(): Prompter {
  return {
    text: async (q) => answered(await clack.text({ message: q.message })),
    password: async (q) =>
      answered(await clack.password({ message: q.message })),
    select: async (q) =>
      chosen(
        q,
        answered(
          await clack.select({ message: q.message, options: labelled(q) }),
        ),
      ),
    multiselect: async (q) =>
      answered(
        await clack.multiselect({
          message: q.message,
          options: labelled(q),
          required: false,
        }),
      ).map((pick) => chosen(q, pick)),
    confirm: async (q) => answered(await clack.confirm({ message: q.message })),
  };
}

function missing(q: Question): Promise<never> {
  return Promise.reject(new CliUsage(usageMissingFlag(q.flag)));
}

/** Without a TTY every question is a usage error naming its flag (PD3). */
export function noTtyPrompter(): Prompter {
  return {
    text: (q) => missing(q),
    password: (q) => missing(q),
    select: (q) => missing(q),
    multiselect: (q) => missing(q),
    confirm: (q) => missing(q),
  };
}
