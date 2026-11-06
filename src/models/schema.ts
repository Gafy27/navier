import { appError, err, ErrorCode, ok, z } from '../index.ts';
import type { Result } from '../index.ts';

/** Non-empty, with no leading or trailing whitespace. */
const PLAIN_TEXT = /^\S(?:.*\S)?$/u;
const plainText = z.string().regex(PLAIN_TEXT);

export const ModelChoiceSchema = z.strictObject({
  provider: plainText,
  model: plainText,
  reasoningEffort: plainText.nullable(),
});

export const ModelPolicySchema = z.strictObject({
  provider: plainText,
  model: plainText,
  enabled: z.boolean(),
  degraded: z.boolean(),
});

export type ModelChoice = z.output<typeof ModelChoiceSchema>;
export type ModelPolicy = z.output<typeof ModelPolicySchema>;

/** A model named by provider and id. A `ModelChoice` fits. */
export type ModelRef = Pick<ModelChoice, 'provider' | 'model'>;

function issueFields(issue: z.core.$ZodIssue, root: string): string[] {
  if (issue.code === 'unrecognized_keys') {
    const prefix =
      issue.path.length === 0 ? '' : `${issue.path.map(String).join('.')}.`;
    return issue.keys.map((key) => `${prefix}${key}`);
  }
  const path = issue.path.map(String).join('.');
  return [path === '' ? root : path];
}

function invalidFields(
  issues: readonly z.core.$ZodIssue[],
  root: string,
): string {
  const fields = issues.flatMap((issue) => issueFields(issue, root));
  if (fields.length === 0) return `${root}: invalid`;
  return [...new Set(fields)]
    .sort()
    .map((field) => `${field}: invalid`)
    .join(', ');
}

/** The policy body. The message names fields, never a submitted value. */
export function parseModelPolicy(raw: unknown): Result<ModelPolicy> {
  const parsed = ModelPolicySchema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);
  return err(
    appError(
      ErrorCode.invalid_argument,
      invalidFields(parsed.error.issues, 'policy'),
    ),
  );
}

/** A `model_policy` row this unit stored. A mismatch is a storage bug. */
export function readModelPolicy(row: unknown): ModelPolicy {
  const parsed = ModelPolicySchema.safeParse(row);
  if (!parsed.success) {
    throw new Error(
      `model_policy row is invalid: ${invalidFields(parsed.error.issues, 'policy')}`,
    );
  }
  return parsed.data;
}
