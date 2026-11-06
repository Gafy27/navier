import type { Command } from 'commander';
import { listCatalogOperations } from '../../client/index.ts';
import type { CatalogOperation, ClientResult } from '../../client/index.ts';
import { err, ok, z } from '../../index.ts';
import type { Result } from '../../index.ts';
import type { CliContext, Io } from './context.ts';
import { AuthKind } from './credentials.ts';
import { ERROR_LINE_SEP, STREAM_FAILURE_NAME } from './constants.ts';
import { usageMissingFlag } from './copy.ts';
import { CliFailure, CliUsage } from './failure.ts';
import { builderPrincipal } from './principal.ts';

/** Catalog operation ids, each named once. The contract test holds every one against the catalog. */
export const OP = {
  addGroupMember: 'addGroupMember',
  addOrgMember: 'addOrgMember',
  addSpaceEditor: 'addSpaceEditor',
  addSpaceMember: 'addSpaceMember',
  applyMarking: 'applyMarking',
  approveBlockedAction: 'approveBlockedAction',
  archiveAgent: 'archiveAgent',
  assignOrgRole: 'assignOrgRole',
  callback: 'callback',
  checkObjects: 'checkObjects',
  createAgent: 'createAgent',
  createGroup: 'createGroup',
  createMarking: 'createMarking',
  createMarkingCategory: 'createMarkingCategory',
  createOrg: 'createOrg',
  createSpace: 'createSpace',
  createTool: 'createTool',
  deleteConversation: 'deleteConversation',
  denyBlockedAction: 'denyBlockedAction',
  drainTool: 'drainTool',
  editMessage: 'editMessage',
  getAgent: 'getAgent',
  getAgentVersion: 'getAgentVersion',
  getConversation: 'getConversation',
  getOpenApi: 'getOpenApi',
  getOrg: 'getOrg',
  getOrgConfig: 'getOrgConfig',
  getSpace: 'getSpace',
  getTool: 'getTool',
  handoff: 'handoff',
  listAgentVersions: 'listAgentVersions',
  listAgents: 'listAgents',
  listAuditEvents: 'listAuditEvents',
  listBlockedActions: 'listBlockedActions',
  listConversations: 'listConversations',
  listGrantable: 'listGrantable',
  listGrants: 'listGrants',
  listGroupMembers: 'listGroupMembers',
  listGroups: 'listGroups',
  listMarkingCategories: 'listMarkingCategories',
  listMarkings: 'listMarkings',
  listModels: 'listModels',
  listOrgMembers: 'listOrgMembers',
  listOrgs: 'listOrgs',
  listProviders: 'listProviders',
  listRoles: 'listRoles',
  listSpaceMembers: 'listSpaceMembers',
  listSpaces: 'listSpaces',
  listTools: 'listTools',
  login: 'login',
  logout: 'logout',
  me: 'me',
  message: 'message',
  patchOrgConfig: 'patchOrgConfig',
  pollMessageEvents: 'pollMessageEvents',
  postMessage: 'postMessage',
  publishAgentVersion: 'publishAgentVersion',
  removeGroupMember: 'removeGroupMember',
  removeMarking: 'removeMarking',
  removeOrgMember: 'removeOrgMember',
  removeSpaceEditor: 'removeSpaceEditor',
  removeSpaceMember: 'removeSpaceMember',
  renameConversation: 'renameConversation',
  renameOrg: 'renameOrg',
  renameSpace: 'renameSpace',
  restoreAgent: 'restoreAgent',
  retireTool: 'retireTool',
  retryMessage: 'retryMessage',
  setAgentPublished: 'setAgentPublished',
  setModelPolicy: 'setModelPolicy',
  setProvider: 'setProvider',
  setProviderKey: 'setProviderKey',
  setToolEnabled: 'setToolEnabled',
  setToolSpaces: 'setToolSpaces',
  startConversation: 'startConversation',
  stopMessages: 'stopMessages',
  unassignOrgRole: 'unassignOrgRole',
  updateAgent: 'updateAgent',
  writeCategoryRoles: 'writeCategoryRoles',
  writeGrants: 'writeGrants',
  writeMarkingRoles: 'writeMarkingRoles',
} as const;

/** One row of the leaf table: a noun-verb command that maps to one operation (PD2). */
export interface Leaf {
  readonly path: readonly [string, string, ...string[]];
  readonly operationId: string;
  readonly bodyDefaults?: Readonly<Record<string, unknown>>;
  readonly stream?: true;
}

export type Input = Record<string, unknown>;

const SCALAR = {
  string: 'string',
  number: 'number',
  integer: 'integer',
  boolean: 'boolean',
} as const;
type ScalarType = (typeof SCALAR)[keyof typeof SCALAR];
const SCALAR_TYPES: readonly ScalarType[] = Object.values(SCALAR);

const SCHEMA = { type: 'type', properties: 'properties', required: 'required' };

const ANSWER = { ask: 'ask', defaults: 'defaults' } as const;
type Answer = (typeof ANSWER)[keyof typeof ANSWER];

const BODY = 'body';
const FLAG_PREFIX = '--';
const ROOT_PATH = 'input';
const TRUE_TEXT = 'true';
const FALSE_TEXT = 'false';
const NEWLINE = '\n';
const PATH_SEP = '.';
const LIST_SEP = ', ';
const TYPEOF = { object: 'object', string: 'string' } as const;
const WIRE_TYPE_FIELD = 'type';

const YES = 'yes';
const CONTEXT = { org: 'org', space: 'space' } as const;
const PRINCIPAL = 'principal';
const SUB = 'sub';
const KEY_FIELD = 'key';
const AGENT_VIEW = 'view';
const AGENT_VIEW_USE = 'use';
const LIMIT = 'limit';

/** Operation fields that hold a secret (D2): a masked prompt, never a flag or an argument. */
export const SECRET_FIELDS: Readonly<Record<string, readonly string[]>> = {
  [OP.setProviderKey]: [KEY_FIELD],
};

/** Input key → the list operation whose rows fill it when the key is missing (program § Select sources). */
export const SELECT_SOURCES: Readonly<Record<string, string>> = {
  org: OP.listOrgs,
  space: OP.listSpaces,
  agent: OP.listAgents,
  tool: OP.listTools,
  group: OP.listGroups,
  role: OP.listRoles,
};

/** Operations that take a `--sub` and build the wire `principal` from `me` (P13.8 PD5). */
export const PRINCIPAL_SUB_OPS: ReadonlySet<string> = new Set([
  OP.addOrgMember,
  OP.addSpaceMember,
  OP.addGroupMember,
  OP.assignOrgRole,
  OP.unassignOrgRole,
]);

/** Remove operations that pick the principal from the members list. */
export const PRINCIPAL_MEMBER_LIST: Readonly<Record<string, string>> = {
  [OP.removeOrgMember]: OP.listOrgMembers,
  [OP.removeSpaceMember]: OP.listSpaceMembers,
  [OP.removeGroupMember]: OP.listGroupMembers,
};

/** Fixed query input for a list call the CLI makes to fill a select; the design names `view=use` for agents. */
const SOURCE_INPUT: Readonly<Record<string, Input>> = {
  [OP.listAgents]: { [AGENT_VIEW]: AGENT_VIEW_USE },
};

const MESSAGE = {
  expectedFlag: 'expected a flag',
  unknownOperation: 'unknown operation',
  noOperation: 'missing operation id',
  notJson: 'argument is not JSON',
  unexpectedList: 'unexpected list response',
  unexpectedMe: 'unexpected whoami response',
  noCatalogEntry: 'no catalog operation: ',
  emptyPath: 'leaf path has no verb',
  missingValue: 'missing value for',
  unknownFlag: 'unknown flag',
  notAFlag: 'cannot be set by a flag',
  collision: 'flag collision',
  secretRefused: 'holds a secret and is never an argument',
} as const;

const Me = z.object({ principal: z.string(), kind: AuthKind });
const Row = z.object({
  id: z.string().optional(),
  key: z.string().optional(),
  name: z.string().optional(),
});
const RowPage = z.object({ items: z.array(Row) });
const MemberPage = z.object({
  grants: z.array(z.object({ principal: z.string() })),
});

interface Option {
  readonly value: string;
  readonly label: string;
}

interface Slot {
  readonly key: string;
  readonly body: boolean;
  readonly type: ScalarType | undefined;
  readonly required: boolean;
}

interface JsonSchema {
  type?: string | readonly string[];
  properties?: Readonly<Record<string, JsonSchema>>;
  required?: readonly string[];
}

export function isInput(value: unknown): value is Input {
  return (
    typeof value === TYPEOF.object && value !== null && !Array.isArray(value)
  );
}

function isText(value: unknown): value is string {
  return typeof value === TYPEOF.string;
}

function isStringList(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.every((item: unknown) => typeof item === TYPEOF.string)
  );
}

function jsonSchema(value: unknown): JsonSchema {
  if (!isInput(value)) return {};
  const schema: JsonSchema = {};
  const type = value[SCHEMA.type];
  if (isText(type) || isStringList(type)) schema.type = type;
  const properties = value[SCHEMA.properties];
  if (isInput(properties)) {
    schema.properties = Object.fromEntries(
      Object.entries(properties).map(([key, child]) => [
        key,
        jsonSchema(child),
      ]),
    );
  }
  const required = value[SCHEMA.required];
  if (isStringList(required)) schema.required = required;
  return schema;
}

function scalarType(schema: JsonSchema): ScalarType | undefined {
  const types =
    schema.type === undefined
      ? []
      : isText(schema.type)
        ? [schema.type]
        : schema.type;
  return SCALAR_TYPES.find((kind) => types.includes(kind));
}

/** Every top-level and body field of an operation's input, with whether it is required. */
function slotsOf(op: CatalogOperation): readonly Slot[] {
  const root = jsonSchema(z.toJSONSchema(op.input));
  const { [BODY]: body, ...top } = root.properties ?? {};
  const fields = (
    owner: JsonSchema,
    properties: Readonly<Record<string, JsonSchema>>,
    inBody: boolean,
  ): Slot[] =>
    Object.entries(properties).map(([key, field]) => ({
      key,
      body: inBody,
      type: scalarType(field),
      required: (owner.required ?? []).includes(key),
    }));
  return [
    ...fields(root, top, false),
    ...(body === undefined ? [] : fields(body, body.properties ?? {}, true)),
  ];
}

/** A flag value that does not match its type stays a string, so the schema check reports the path, not the text. */
function coerce(text: string, type: ScalarType): unknown {
  if (type === SCALAR.string) return text;
  if (type === SCALAR.boolean) {
    if (text === TRUE_TEXT) return true;
    if (text === FALSE_TEXT) return false;
    return text;
  }
  const number = Number(text);
  if (!Number.isFinite(number)) return text;
  if (type === SCALAR.integer && !Number.isInteger(number)) return text;
  return number;
}

function bodyOf(input: Input): Input {
  const body = input[BODY];
  return isInput(body) ? body : {};
}

function isSet(input: Input, slot: Slot): boolean {
  return (slot.body ? bodyOf(input) : input)[slot.key] !== undefined;
}

function withSlot(input: Input, slot: Slot, value: unknown): Input {
  if (!slot.body) return { ...input, [slot.key]: value };
  return { ...input, [BODY]: { ...bodyOf(input), [slot.key]: value } };
}

function slotNamed(op: CatalogOperation, key: string): Slot {
  return (
    slotsOf(op).find((slot) => slot.key === key) ?? {
      key,
      body: false,
      type: undefined,
      required: false,
    }
  );
}

function withBodyDefaults(
  op: CatalogOperation,
  input: Input,
  fixed: Input,
): Input {
  return Object.entries(fixed).reduce<Input>(
    (acc, [key, value]) => withSlot(acc, slotNamed(op, key), value),
    input,
  );
}

export function isSecretField(operationId: string, key: string): boolean {
  return (SECRET_FIELDS[operationId] ?? []).includes(key);
}

/** The first secret field the input carries, by name only. Never a value (G6). */
export function secretIn(
  operationId: string,
  input: unknown,
): string | undefined {
  if (!isInput(input)) return undefined;
  const body = bodyOf(input);
  return (SECRET_FIELDS[operationId] ?? []).find(
    (key) => input[key] !== undefined || body[key] !== undefined,
  );
}

export function secretRefused(key: string): string {
  return `${FLAG_PREFIX}${key} ${MESSAGE.secretRefused}`;
}

function missingValue(key: string): string {
  return `${MESSAGE.missingValue} ${FLAG_PREFIX}${key}`;
}

function unknownFlag(key: string): string {
  return `${MESSAGE.unknownFlag} ${FLAG_PREFIX}${key}`;
}

function notAFlag(key: string): string {
  return `${FLAG_PREFIX}${key} ${MESSAGE.notAFlag}`;
}

function collision(keys: readonly string[]): string {
  return `${MESSAGE.collision}: ${keys.join(LIST_SEP)}`;
}

/** Reads `--key value` pairs against the operation's fields, with no request and no prompt. */
export function parseFlags(
  op: CatalogOperation,
  argv: readonly string[],
  extra: readonly string[],
): Result<Input, CliUsage> {
  const slots = slotsOf(op);
  const top = new Set(slots.filter((slot) => !slot.body).map((s) => s.key));
  const clashing = slots
    .filter((slot) => slot.body && top.has(slot.key))
    .map((slot) => slot.key);
  if (clashing.length > 0) return err(new CliUsage(collision(clashing)));
  let input: Input = {};
  let index = 0;
  while (index < argv.length) {
    const token = argv[index];
    index += 1;
    if (
      token === undefined ||
      !token.startsWith(FLAG_PREFIX) ||
      token.length <= FLAG_PREFIX.length
    ) {
      return err(new CliUsage(MESSAGE.expectedFlag));
    }
    const key = token.slice(FLAG_PREFIX.length);
    if (isSecretField(op.operationId, key)) {
      return err(new CliUsage(secretRefused(key)));
    }
    const text = argv[index];
    if (text === undefined || text.startsWith(FLAG_PREFIX)) {
      return err(new CliUsage(missingValue(key)));
    }
    index += 1;
    const slot = slots.find((candidate) => candidate.key === key);
    if (slot === undefined && !extra.includes(key)) {
      return err(new CliUsage(unknownFlag(key)));
    }
    const field = slot ?? {
      key,
      body: false,
      type: SCALAR.string,
      required: false,
    };
    if (field.type === undefined) return err(new CliUsage(notAFlag(key)));
    input = withSlot(input, field, coerce(text, field.type));
  }
  return ok(input);
}

function issuePaths(
  issues: readonly { readonly path: readonly PropertyKey[] }[],
): string {
  return issues
    .map((issue) =>
      issue.path.length === 0
        ? ROOT_PATH
        : issue.path.map(String).join(PATH_SEP),
    )
    .join(LIST_SEP);
}

/** The one schema check every command runs before a request (P13.7 D6). */
export function checkInput(
  op: CatalogOperation,
  input: Input,
): Result<Input, CliUsage> {
  const parsed = op.input.safeParse(input);
  if (!parsed.success) {
    return err(new CliUsage(issuePaths(parsed.error.issues)));
  }
  return ok(parsed.data);
}

export function catalogOperation(
  operationId: string,
): CatalogOperation | undefined {
  return listCatalogOperations().find((op) => op.operationId === operationId);
}

function operationOf(operationId: string): CatalogOperation {
  const op = catalogOperation(operationId);
  if (op === undefined)
    throw new Error(`${MESSAGE.noCatalogEntry}${operationId}`);
  return op;
}

function apiFailure(error: {
  readonly type: string;
  readonly message: string;
}): CliFailure {
  return new CliFailure(`${error.type}${ERROR_LINE_SEP}${error.message}`);
}

/** Prints one result as JSON on success; a failure becomes a `CliFailure`, so `runCli` exits 1 (PD8). */
export function printResult(result: ClientResult<unknown>, io: Io): void {
  if (!result.ok) throw apiFailure(result.error);
  io.stdout(`${JSON.stringify(result.value)}${NEWLINE}`);
}

function isStreamFailure(
  cause: unknown,
): cause is Error & { readonly type: string } {
  return (
    cause instanceof Error &&
    cause.name === STREAM_FAILURE_NAME &&
    WIRE_TYPE_FIELD in cause &&
    typeof cause.type === TYPEOF.string
  );
}

/** One JSON object per line on stdout; a stream failure becomes a `CliFailure` (PD8). */
export async function emitFrames(
  frames: AsyncIterable<unknown>,
  io: Io,
): Promise<void> {
  try {
    for await (const frame of frames) {
      io.stdout(`${JSON.stringify(frame)}${NEWLINE}`);
    }
  } catch (cause) {
    if (isStreamFailure(cause)) throw apiFailure(cause);
    throw cause;
  }
}

function groupOf(program: Command, names: readonly string[]): Command {
  return names.reduce<Command>(
    (parent, name) =>
      parent.commands.find((command) => command.name() === name) ??
      parent.command(name),
    program,
  );
}

function promptFlag(op: CatalogOperation, slot: Slot): string {
  return PRINCIPAL_SUB_OPS.has(op.operationId) && slot.key === PRINCIPAL
    ? SUB
    : slot.key;
}

function refuseWithYes(answer: Answer, flag: string): void {
  if (answer === ANSWER.defaults) throw new CliUsage(usageMissingFlag(flag));
}

async function askText(
  ctx: CliContext,
  answer: Answer,
  flag: string,
): Promise<string> {
  refuseWithYes(answer, flag);
  return ctx.env.prompter.text({ message: flag, flag });
}

async function askSecret(
  ctx: CliContext,
  answer: Answer,
  flag: string,
): Promise<string> {
  refuseWithYes(answer, flag);
  return ctx.env.prompter.password({ message: flag, flag });
}

/** `--yes` picks a single option and never invents a choice among several (D2). */
async function pick(
  ctx: CliContext,
  answer: Answer,
  flag: string,
  options: readonly Option[],
): Promise<string> {
  const only = options[0];
  if (answer === ANSWER.defaults) {
    if (options.length === 1 && only !== undefined) return only.value;
    throw new CliUsage(usageMissingFlag(flag));
  }
  if (only === undefined) throw new CliUsage(usageMissingFlag(flag));
  return ctx.env.prompter.select({ message: flag, flag, options });
}

/** A list call takes the top-level values the leaf already has, such as `org` and `limit`, so it does not ask twice. */
function inheritedFrom(list: CatalogOperation, input: Input): Input {
  return Object.fromEntries(
    slotsOf(list)
      .filter((slot) => !slot.body && input[slot.key] !== undefined)
      .map((slot) => [slot.key, input[slot.key]]),
  );
}

/** Runs a list operation for a select, filling its own missing inputs the same way. */
async function listRows(
  ctx: CliContext,
  listId: string,
  answer: Answer,
  input: Input,
): Promise<unknown> {
  const list = operationOf(listId);
  const seed: Input = {
    ...inheritedFrom(list, input),
    ...(SOURCE_INPUT[listId] ?? {}),
  };
  const filled = await fillRequired(ctx, list, seed, answer);
  const checked = checkInput(list, filled);
  if (!checked.ok) throw checked.error;
  const result = await ctx.call(listId, checked.value);
  if (!result.ok) throw apiFailure(result.error);
  return result.value;
}

async function sourceOptions(
  ctx: CliContext,
  listId: string,
  answer: Answer,
  input: Input,
): Promise<Option[]> {
  const page = RowPage.safeParse(await listRows(ctx, listId, answer, input));
  if (!page.success) throw new CliFailure(MESSAGE.unexpectedList);
  return page.data.items.flatMap((row) => {
    const value = row.id ?? row.key;
    return value === undefined ? [] : [{ value, label: row.name ?? value }];
  });
}

async function memberOptions(
  ctx: CliContext,
  listId: string,
  answer: Answer,
  input: Input,
): Promise<Option[]> {
  const page = MemberPage.safeParse(await listRows(ctx, listId, answer, input));
  if (!page.success) throw new CliFailure(MESSAGE.unexpectedList);
  return page.data.grants.map((row) => ({
    value: row.principal,
    label: row.principal,
  }));
}

/** A grantee `sub` becomes the wire principal from the caller's own `me` (P13.8 PD5). */
async function principalFromSub(
  ctx: CliContext,
  input: Input,
  answer: Answer,
): Promise<string> {
  const given = input[SUB];
  const sub = isText(given) ? given : await askText(ctx, answer, SUB);
  const me = await ctx.call(OP.me, {});
  if (!me.ok) throw apiFailure(me.error);
  const who = Me.safeParse(me.value);
  if (!who.success) throw new CliFailure(MESSAGE.unexpectedMe);
  const principal = builderPrincipal(who.data, sub);
  if (!principal.ok) throw principal.error;
  return principal.value;
}

async function contextValue(
  ctx: CliContext,
  slot: Slot,
): Promise<string | undefined> {
  if (slot.body) return undefined;
  if (slot.key !== CONTEXT.org && slot.key !== CONTEXT.space) return undefined;
  const file = await ctx.credentials.read();
  return slot.key === CONTEXT.org ? file?.org : file?.space;
}

async function answerSlot(
  ctx: CliContext,
  op: CatalogOperation,
  slot: Slot,
  input: Input,
  answer: Answer,
): Promise<unknown> {
  const fromContext = await contextValue(ctx, slot);
  if (fromContext !== undefined) return fromContext;
  if (!ctx.env.io.isTTY)
    throw new CliUsage(usageMissingFlag(promptFlag(op, slot)));
  if (PRINCIPAL_SUB_OPS.has(op.operationId) && slot.key === PRINCIPAL) {
    return principalFromSub(ctx, input, answer);
  }
  const memberList = PRINCIPAL_MEMBER_LIST[op.operationId];
  if (memberList !== undefined && slot.key === PRINCIPAL) {
    const options = await memberOptions(ctx, memberList, answer, input);
    return pick(ctx, answer, slot.key, options);
  }
  if (isSecretField(op.operationId, slot.key)) {
    return askSecret(ctx, answer, slot.key);
  }
  const source = SELECT_SOURCES[slot.key];
  if (source !== undefined) {
    const options = await sourceOptions(ctx, source, answer, input);
    return pick(ctx, answer, slot.key, options);
  }
  const text = await askText(ctx, answer, slot.key);
  return slot.type === undefined ? text : coerce(text, slot.type);
}

/** The form does not ask for a page size. `--limit` still sets it; otherwise the call asks for every row. */
function fillLimit(op: CatalogOperation, input: Input): Input {
  const slot = slotsOf(op).find((item) => item.key === LIMIT);
  if (slot === undefined || !slot.required || isSet(input, slot)) return input;
  return withSlot(input, slot, Number.MAX_SAFE_INTEGER);
}

/** Fills each missing required input in schema order. A key with a body default is never asked. */
async function fillRequired(
  ctx: CliContext,
  op: CatalogOperation,
  input: Input,
  answer: Answer,
): Promise<Input> {
  let filled = fillLimit(op, input);
  for (const slot of slotsOf(op)) {
    if (!slot.required || isSet(filled, slot)) continue;
    const value = await answerSlot(ctx, op, slot, filled, answer);
    filled = withSlot(filled, slot, value);
  }
  return filled;
}

async function runLeaf(
  ctx: CliContext,
  leaf: Leaf,
  op: CatalogOperation,
  command: Command,
): Promise<void> {
  const answer =
    command.optsWithGlobals()[YES] === true ? ANSWER.defaults : ANSWER.ask;
  const extra = PRINCIPAL_SUB_OPS.has(op.operationId) ? [SUB] : [];
  const flags = parseFlags(op, command.args, extra);
  if (!flags.ok) throw flags.error;
  const withDefaults = withBodyDefaults(
    op,
    flags.value,
    leaf.bodyDefaults ?? {},
  );
  const filled = await fillRequired(ctx, op, withDefaults, answer);
  const checked = checkInput(op, filled);
  if (!checked.ok) throw checked.error;
  if (leaf.stream === true) {
    await emitFrames(
      await ctx.streamCall(op.operationId, checked.value),
      ctx.env.io,
    );
    return;
  }
  printResult(await ctx.call(op.operationId, checked.value), ctx.env.io);
}

/** Adds one leaf command. It reads flags from the catalog input and ends in `ctx.call` (PD2, PD3). */
export function defineLeaf(
  program: Command,
  leaf: Leaf,
  ctx: CliContext,
): void {
  const op = operationOf(leaf.operationId);
  const parents = leaf.path.slice(0, -1);
  const verb = leaf.path.at(-1);
  if (verb === undefined) throw new Error(MESSAGE.emptyPath);
  groupOf(program, parents)
    .command(verb)
    .description(op.summary)
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .action(async (_options: unknown, command: Command) => {
      await runLeaf(ctx, leaf, op, command);
    });
}
