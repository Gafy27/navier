import { appError, ErrorCode, err, ok, z } from '../index.ts';
import type { Result } from '../index.ts';
import { SCOPE_GRAMMAR } from '../identity/index.ts';
import { ModelChoiceSchema } from '../models/index.ts';
import { LimitsSchema } from './limits.ts';

const NAME_MAX = 200;
const DESCRIPTION_MAX = 2_000;
const INSTRUCTIONS_MAX = 100_000;
const TEXT = /^\S(?:.*\S)?$/u;
const EMPTY_OR_TEXT = /^(?:\S(?:.*\S)?)?$/u;

const SLOT_PHASE: Readonly<Record<string, string>> = {
  workspace: 'phases 7 and 9',
  skills: 'phase 11',
  subagents: 'phase 12',
};

const Approval = ['never_ask', 'low', 'medium', 'high'] as const;

const jsonObject = z.record(z.string(), z.unknown());

const ToolRefSchema = z.strictObject({
  key: z.string().refine((key) => SCOPE_GRAMMAR.tool.validId(key)),
  implementationVersion: z.number().int().min(1),
  config: jsonObject.nullable().default(null),
  approval: z.enum(Approval).nullable().default(null),
});

function boundedText(max: number, pattern: RegExp) {
  return z.string().max(max).regex(pattern);
}

function uniqueToolKeys(
  tools: readonly { key: string }[],
  ctx: z.core.$RefinementCtx<readonly { key: string }[]>,
): void {
  const seen = new Set<string>();
  for (const [index, tool] of tools.entries()) {
    if (!seen.has(tool.key)) {
      seen.add(tool.key);
      continue;
    }
    ctx.addIssue({
      code: 'custom',
      path: [index, 'key'],
      message: 'duplicate',
    });
  }
}

/** The save body without `id`. */
export const AgentDocumentSchema = z.strictObject({
  name: boundedText(NAME_MAX, TEXT),
  description: boundedText(DESCRIPTION_MAX, EMPTY_OR_TEXT).default(''),
  instructions: boundedText(INSTRUCTIONS_MAX, TEXT),
  model: ModelChoiceSchema,
  fallbacks: z.array(ModelChoiceSchema).default(() => []),
  tools: z.array(ToolRefSchema).superRefine(uniqueToolKeys),
  memory: z.strictObject({
    workingMemoryScope: z.enum(['thread', 'resource']),
    messageHistory: z.strictObject({
      maxMessages: z.number().int().min(1),
    }),
  }),
  limits: LimitsSchema,
  workspace: z.null().default(null),
  skills: z.array(z.never()).default(() => []),
  subagents: z.array(z.never()).default(() => []),
});

export type AgentDocument = z.input<typeof AgentDocumentSchema>;
/** What the parse accepts: snapshot fields may be absent. */
export type ParsedDefinition = z.output<typeof AgentDocumentSchema>;

/** The five version fields an omitted input copies from the snapshot. */
export interface VersionDefaults {
  readonly maxSteps: number;
  readonly pauseTimeout: string;
  readonly maxTraceOutputBytes: number;
  readonly maxToolsPerVersion: number;
  readonly maxFallbacks: number;
}

/** The stored definition: every snapshot field that belongs to a version is filled. */
export type AgentDefinition = Omit<ParsedDefinition, 'limits'> & {
  readonly limits: Omit<ParsedDefinition['limits'], keyof VersionDefaults> &
    VersionDefaults;
};
export type ToolRef = z.output<typeof ToolRefSchema>;
export type { ModelChoice } from '../models/index.ts';

function issueText(issue: z.core.$ZodIssue): string {
  const head = issue.path[0];
  if (typeof head === 'string') {
    const phase = SLOT_PHASE[head];
    if (phase !== undefined) return `${head} (${issue.code}): ${phase}`;
  }
  if (issue.code === 'unrecognized_keys') {
    const prefix =
      issue.path.length === 0 ? '' : `${issue.path.map(String).join('.')}.`;
    return issue.keys
      .map((key) => `${prefix}${key} (unrecognized_keys)`)
      .join(', ');
  }
  const path = issue.path.map(String).join('.');
  return path === '' ? `(${issue.code})` : `${path} (${issue.code})`;
}

/** Path and issue code only, so a rejected value cannot leak. */
export function parseAgentDocument(raw: unknown): Result<ParsedDefinition> {
  const parsed = AgentDocumentSchema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);
  const message = parsed.error.issues.map(issueText).sort().join(', ');
  return err(appError(ErrorCode.invalid_argument, message));
}

/** Copies each omitted version field from `defaults`. A set value is kept. */
export function fillVersionLimits(
  def: ParsedDefinition,
  defaults: VersionDefaults,
): AgentDefinition {
  const limits = def.limits;
  return {
    ...def,
    limits: {
      ...limits,
      maxSteps: limits.maxSteps ?? defaults.maxSteps,
      pauseTimeout: limits.pauseTimeout ?? defaults.pauseTimeout,
      maxTraceOutputBytes:
        limits.maxTraceOutputBytes ?? defaults.maxTraceOutputBytes,
      maxToolsPerVersion:
        limits.maxToolsPerVersion ?? defaults.maxToolsPerVersion,
      maxFallbacks: limits.maxFallbacks ?? defaults.maxFallbacks,
    },
  };
}

const STORED_LIMITS = [
  'maxSteps',
  'pauseTimeout',
  'maxTraceOutputBytes',
  'maxToolsPerVersion',
  'maxFallbacks',
] as const satisfies readonly (keyof VersionDefaults)[];

/** A stored definition. A row always holds the filled fields, so an absent one is `invalid_argument`. */
export function parseStoredDefinition(raw: unknown): Result<AgentDefinition> {
  const parsed = parseAgentDocument(raw);
  if (!parsed.ok) return parsed;
  const limits = parsed.value.limits;
  const missing = STORED_LIMITS.filter((field) => limits[field] === undefined);
  if (missing.length > 0) {
    return err(
      appError(
        ErrorCode.invalid_argument,
        missing.map((field) => `limits.${field} (required)`).join(', '),
      ),
    );
  }
  return ok(fillVersionLimits(parsed.value, limits as VersionDefaults));
}

/** `tools.length` and `fallbacks.length` against the caps stored on the version. */
export function checkStoredCaps(def: AgentDefinition): Result<void> {
  if (def.tools.length > def.limits.maxToolsPerVersion) {
    return err(appError(ErrorCode.invalid_argument, 'tools: above ceiling'));
  }
  if (def.fallbacks.length > def.limits.maxFallbacks) {
    return err(
      appError(ErrorCode.invalid_argument, 'fallbacks: above ceiling'),
    );
  }
  return ok(undefined);
}
