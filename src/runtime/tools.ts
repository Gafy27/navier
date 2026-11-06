import { appError, err, ErrorCode, ok, z } from '../index.ts';
import type { Result } from '../index.ts';
import type { OrgId } from '../db/index.ts';
import type { JsonValue, RequestContext } from './request-context.ts';
import type { BlockKind } from './status.ts';

declare const blockedBrand: unique symbol;

/** An opaque value made only by `ToolContext.block`. A tool returns it as its result. */
export interface Blocked {
  readonly [blockedBrand]: true;
}

/** The kinds a tool may block with. `approval` is the verdict's alone. */
export type ToolBlockKind =
  typeof BlockKind.authentication | typeof BlockKind.retry;

/** The five ids a tool sees. No caller, token, or principal. */
export interface ToolIds {
  readonly org: OrgId;
  readonly threadId: string;
  readonly agentMessageId: string;
  readonly actionId: string;
  readonly agentId: string;
}

export interface ToolContext {
  readonly requestContext: Readonly<RequestContext>;
  readonly abortSignal: AbortSignal;
  readonly ids: ToolIds;
  /** The pointer stored by an earlier attempt, or `null` on a first attempt. */
  readonly resumePointer: JsonValue | null;
  /** Stores `pointer` on the action. A `null` pointer reads back as no pointer. */
  readonly saveResumePointer: (pointer: JsonValue) => Promise<Result<void>>;
  /** The call's result: this action waits on `kind`, carrying `pointer`. */
  readonly block: (kind: ToolBlockKind, pointer: JsonValue | null) => Blocked;
  /** The pointer of the block this attempt answers, else `null`. */
  readonly blockPointer: JsonValue | null;
}

export interface ToolImplementation {
  readonly key: string;
  readonly implementationVersion: number;
  readonly execute: (
    input: unknown,
    ctx: ToolContext,
  ) => Promise<JsonValue | Blocked>;
}

export interface ToolRegistry {
  readonly get: (
    key: string,
    implementationVersion: number,
  ) => ToolImplementation | undefined;
}

const ImplementationShape = z.object({
  key: z.string().min(1),
  implementationVersion: z.number().int().min(1),
  execute: z.custom<ToolImplementation['execute']>(
    (value) => typeof value === 'function',
  ),
});

/** A registry of `impls`. `already_exists` names a repeated `key@version`; `invalid_argument` a malformed implementation. */
export function createToolRegistry(
  impls: readonly ToolImplementation[],
): Result<ToolRegistry> {
  const byKey = new Map<string, Map<number, ToolImplementation>>();
  for (const impl of impls) {
    if (!ImplementationShape.safeParse(impl).success) {
      return err(
        appError(ErrorCode.invalid_argument, 'invalid implementation'),
      );
    }
    const versions =
      byKey.get(impl.key) ?? new Map<number, ToolImplementation>();
    if (versions.has(impl.implementationVersion)) {
      return err(
        appError(
          ErrorCode.already_exists,
          `${impl.key}@${String(impl.implementationVersion)}: repeated`,
        ),
      );
    }
    versions.set(impl.implementationVersion, impl);
    byKey.set(impl.key, versions);
  }
  return ok({
    get: (key, implementationVersion) =>
      byKey.get(key)?.get(implementationVersion),
  });
}
