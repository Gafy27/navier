import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { z } from '../index.ts';
import { ToolEntryInputSchema, validateToolConfig } from '../catalog/index.ts';
import type { Blocked, ToolContext } from '../runtime/index.ts';
import { SdkError } from './errors.ts';
import { createTool, toImplementation, toToolEntryInput } from './tool.ts';
import type { ToolConfig } from './tool.ts';

const BLOCKED = { token: 'blocked' } as unknown as Blocked;
const ATTEMPTS = 2;
const VERSION = 1;

const validConfig = {
  id: 'lookup_order',
  version: VERSION,
  description: 'looks an order up',
  inputSchema: z.object({ orderId: z.string() }),
  execute: () => Promise.resolve({ ok: true }),
} satisfies ToolConfig<{ orderId: string }>;

function refusedFor(config: object, field: string): void {
  assert.throws(
    () => createTool({ ...validConfig, ...config }),
    (e: unknown) => {
      assert.ok(e instanceof SdkError);
      assert.equal(e.code, 'invalid_argument');
      assert.ok(e.message.includes(field));
      return true;
    },
  );
}

function fakeContext(over: Partial<ToolContext> = {}): ToolContext {
  return {
    requestContext: { tenant: 'acme' },
    abortSignal: new AbortController().signal,
    ids: {
      org: 'o1' as ToolContext['ids']['org'],
      threadId: 't1',
      agentMessageId: 'm1',
      actionId: 'a1',
      agentId: 'ag1',
    },
    resumePointer: null,
    saveResumePointer: () => Promise.resolve({ ok: true, value: undefined }),
    block: () => BLOCKED,
    blockPointer: null,
    ...over,
  };
}

void test('V1: id and version map to the entry; bad ones are refused', () => {
  const entry = toToolEntryInput(createTool(validConfig));
  assert.equal(entry.key, validConfig.id);
  assert.equal(entry.implementationVersion, VERSION);
  assert.equal(entry.name, validConfig.id);
  refusedFor({ id: 'Lookup Order' }, 'id');
  refusedFor({ version: 0 }, 'version');
  refusedFor({ version: 1.5 }, 'version');
});

void test('V2: requireApproval maps to never_ask or high; a function is refused', () => {
  const approval = (requireApproval?: boolean) =>
    toToolEntryInput(
      createTool({
        ...validConfig,
        ...(requireApproval === undefined ? {} : { requireApproval }),
      }),
    ).approval;
  assert.equal(approval(), 'never_ask');
  assert.equal(approval(false), 'never_ask');
  assert.equal(approval(true), 'high');
  refusedFor(
    { requireApproval: ((x: unknown) => x) as never },
    'requireApproval',
  );
});

void test('V3: input schema is draft-07 object JSON, with no $ref', () => {
  const entry = toToolEntryInput(createTool(validConfig));
  assert.equal(entry.inputSchema['type'], 'object');
  assert.ok(!JSON.stringify(entry.inputSchema).includes('$ref'));
  type Node = { next?: Node | undefined };
  const node: z.ZodType<Node> = z.object({
    next: z.lazy(() => node).optional(),
  });
  refusedFor({ inputSchema: node }, 'inputSchema');
});

void test('V3: Zod parses around execute', async () => {
  let called = 0;
  const implementation = toImplementation(
    createTool({
      ...validConfig,
      execute: () => {
        called += 1;
        return Promise.resolve({ ok: true });
      },
    }),
  );
  await assert.rejects(implementation.execute({ orderId: 1 }, fakeContext()));
  assert.equal(called, 0);

  const outputChecked = toImplementation(
    createTool({
      ...validConfig,
      outputSchema: z.object({ n: z.number() }),
      execute: () => Promise.resolve({ n: 'x' } as unknown as { n: number }),
    }),
  );
  await assert.rejects(outputChecked.execute({ orderId: 'o' }, fakeContext()));
});

void test('V3: a refinement the stored schema cannot hold stops at the wrapper', async () => {
  let called = 0;
  const tool = createTool({
    id: 'even',
    version: VERSION,
    description: 'even only',
    inputSchema: z.object({ n: z.number().refine((v) => v % 2 === 0) }),
    execute: () => {
      called += 1;
      return Promise.resolve({ ok: true });
    },
  });
  const entry = toToolEntryInput(tool);
  assert.equal(validateToolConfig(entry.inputSchema, { n: 3 }).ok, true);
  const implementation = toImplementation(tool);
  await assert.rejects(implementation.execute({ n: 3 }, fakeContext()));
  assert.equal(called, 0);
  await implementation.execute({ n: 4 }, fakeContext());
  assert.equal(called, 1);
});

void test('V4: the wrapper builds the Mastra-named context and passes a block through', async () => {
  let seen: Record<string, unknown> = {};
  const implementation = toImplementation(
    createTool({
      ...validConfig,
      execute: (_input, ctx) => {
        seen = { ...ctx };
        ctx.requestContext.set('x', 1);
        return Promise.resolve(ctx.block('retry', { k: 1 }));
      },
    }),
  );
  const result = await implementation.execute({ orderId: 'o' }, fakeContext());
  assert.equal(result, BLOCKED);
  assert.deepEqual(seen['agent'], {
    agentId: 'ag1',
    threadId: 't1',
    messageId: 'm1',
    toolCallId: 'a1',
  });
  for (const hidden of ['org', 'ids', 'suspend']) {
    assert.equal(hidden in seen, false);
  }
});

void test('V4: retry fields appear only when retry is set', () => {
  const without = toToolEntryInput(createTool(validConfig));
  assert.equal('toolAttempts' in without, false);
  assert.equal('retryOnInterrupt' in without, false);
  assert.equal('maxToolOutputBytes' in without, false);
  const withRetry = toToolEntryInput(
    createTool({
      ...validConfig,
      retry: { onInterrupt: true, attempts: ATTEMPTS },
    }),
  );
  assert.equal(withRetry.retryOnInterrupt, true);
  assert.equal(withRetry.toolAttempts, ATTEMPTS);
  assert.equal(ToolEntryInputSchema.safeParse(withRetry).success, true);
});

void test('V10: loading the sdk entry loads no Temporal module', () => {
  const probe = `
    import { register } from 'node:module';
    register('data:text/javascript,' + encodeURIComponent(\`
      export async function resolve(specifier, context, next) {
        if (specifier.includes('@temporalio/')) throw new Error('loaded ' + specifier);
        return next(specifier, context);
      }
    \`));
    await import('./src/sdk/index.ts');
  `;
  execFileSync(process.execPath, ['--input-type=module', '--eval', probe], {
    stdio: 'pipe',
  });
});
