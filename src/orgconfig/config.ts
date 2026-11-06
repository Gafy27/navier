import { appError, err, ErrorCode, ok, z } from '../index.ts';
import type { Result } from '../index.ts';

const PauseUnit = z.enum({
  s: 's',
  m: 'm',
  h: 'h',
  d: 'd',
});

const PAUSE_UNIT_SECONDS = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
} as const satisfies Record<z.infer<typeof PauseUnit>, number>;

const PAUSE_COUNT = /^[1-9][0-9]*$/;

const pauseCount = z.string().regex(PAUSE_COUNT).transform(Number);

/** Digits then a `PauseUnit`: `1h`. `0h` is refused. */
export const pauseTimeoutSchema = z.string().superRefine((value, ctx) => {
  const unit = PauseUnit.options.find((candidate) => value.endsWith(candidate));
  const count = unit === undefined ? undefined : value.slice(0, -unit.length);
  if (count === undefined || !pauseCount.safeParse(count).success) {
    ctx.addIssue({ code: 'custom', message: 'invalid' });
  }
});

export function pauseTimeoutSeconds(duration: string): number {
  const timeout = pauseTimeoutSchema.safeParse(duration);
  if (!timeout.success) return Number.NaN;
  const unit = PauseUnit.options.find((candidate) =>
    timeout.data.endsWith(candidate),
  );
  if (unit === undefined) return Number.NaN;
  const count = pauseCount.safeParse(timeout.data.slice(0, -unit.length));
  if (!count.success) return Number.NaN;
  return count.data * PAUSE_UNIT_SECONDS[unit];
}

const nonNegativeInt = z.number().int().min(0);
const positiveInt = z.number().int().min(1);

/** The seven D2 fields, each a minimum and no maximum. */
const OrgLimitsSchema = z.strictObject({
  maxToolsPerVersion: nonNegativeInt,
  maxFallbacks: nonNegativeInt,
  maxSteps: positiveInt,
  pauseTimeout: pauseTimeoutSchema,
  maxTraceOutputBytes: positiveInt,
  maxToolOutputBytes: positiveInt,
  maxToolAttempts: positiveInt,
});

/** The six D10 fields. Their fallbacks are column defaults, not code. */
const StreamFieldsSchema = z.strictObject({
  streamReplayTtl: pauseTimeoutSchema,
  streamAccessRecheck: pauseTimeoutSchema,
  streamPollHold: pauseTimeoutSchema,
  streamKeepalive: pauseTimeoutSchema,
  streamMaxLifetime: pauseTimeoutSchema,
  maxStreamDeltasPerMessage: positiveInt,
});

/** What a read returns: all thirteen fields. */
export const OrgSnapshotSchema = OrgLimitsSchema.extend(
  StreamFieldsSchema.shape,
);

const OrgPatchSchema = OrgSnapshotSchema.partial();

/** D1: a first row needs the seven D2 fields; a D10 field it omits takes its column default. */
const FirstRowSchema = OrgLimitsSchema.extend(
  StreamFieldsSchema.partial().shape,
);

export type OrgLimits = z.output<typeof OrgLimitsSchema>;
export type OrgFirstRow = z.output<typeof FirstRowSchema>;
export type OrgSnapshot = z.output<typeof OrgSnapshotSchema>;
export type OrgPatch = z.output<typeof OrgPatchSchema>;

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

function invalid(issues: readonly z.core.$ZodIssue[]): Result<never> {
  return err(
    appError(ErrorCode.invalid_argument, invalidFields(issues, 'config')),
  );
}

/** A partial of the thirteen fields. The message names fields, never a value. */
export function parseOrgPatch(raw: unknown): Result<OrgPatch> {
  const parsed = OrgPatchSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error.issues);
  return ok(parsed.data);
}

/** The first row: the seven D2 fields required, each D10 field checked only when present. */
export function parseOrgFirstRow(raw: unknown): Result<OrgFirstRow> {
  const parsed = FirstRowSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error.issues);
  return ok(parsed.data);
}

/** A complete snapshot. The message names each missing or bad field. */
export function parseOrgSnapshot(raw: unknown): Result<OrgSnapshot> {
  const parsed = OrgSnapshotSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error.issues);
  return ok(parsed.data);
}
