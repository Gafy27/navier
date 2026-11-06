import type { Prompter } from './prompts.ts';

type Answer = string | boolean | readonly string[];

/**
 * A queue of answers per flag. An unexpected question throws, so a test fails
 * when a command asks more than it should (PD3, Test seams).
 */
export function scriptedPrompter(
  script: Readonly<Record<string, readonly Answer[]>>,
): Prompter {
  const queues = new Map(
    Object.entries(script).map(([flag, answers]) => [flag, [...answers]]),
  );
  const next = (flag: string): Answer => {
    const answer = queues.get(flag)?.shift();
    if (answer === undefined) {
      throw new Error(`unexpected question for --${flag}`);
    }
    return answer;
  };
  const textOf = (flag: string): Promise<string> => {
    const answer = next(flag);
    if (typeof answer !== 'string') {
      throw new Error(`--${flag} answer is not a string`);
    }
    return Promise.resolve(answer);
  };
  return {
    text: (q) => textOf(q.flag),
    password: (q) => textOf(q.flag),
    select: (q) => {
      const answer = next(q.flag);
      const option = q.options.find((o) => o.value === answer);
      if (option === undefined) {
        throw new Error(`--${q.flag} answer is not an option`);
      }
      return Promise.resolve(option.value);
    },
    multiselect: (q) => {
      const answer = next(q.flag);
      if (!Array.isArray(answer)) {
        throw new Error(`--${q.flag} answer is not a list`);
      }
      const picks = q.options.filter((o) => answer.includes(o.value));
      return Promise.resolve(picks.map((o) => o.value));
    },
    confirm: (q) => {
      const answer = next(q.flag);
      if (typeof answer !== 'boolean') {
        throw new Error(`--${q.flag} answer is not a boolean`);
      }
      return Promise.resolve(answer);
    },
  };
}
