import { z } from '../../index.ts';
import { STATUS } from './errors.ts';
import { SESSION_COOKIE } from './session.ts';
import type { WireType } from './route-types.ts';
import type { RouteContract } from './route-types.ts';

type AnyContract = RouteContract<unknown, unknown, unknown, unknown, unknown>;

/** The contracts a document is built from, keyed by `operationId`. */
export type ContractCatalog = Readonly<Record<string, AnyContract>>;

export type OpenApiDocument = Readonly<Record<string, unknown>>;

const ParameterIn = z.enum({ path: 'path', query: 'query' });
type ParameterIn = z.infer<typeof ParameterIn>;

const SecurityScheme = z.enum({
  bearer: 'bearerAuth',
  sessionCookie: 'sessionCookie',
});

const JSON_CONTENT = 'application/json';
const SSE_CONTENT = 'text/event-stream';
const OK_STATUS = '200';

function envelope(type: WireType): Record<string, unknown> {
  return z.toJSONSchema(
    z.object({
      error: z.object({ type: z.literal(type), message: z.string() }),
    }),
  );
}

/** One OpenAPI parameter per property of an object schema. */
function parameters(
  schema: z.ZodType | undefined,
  where: ParameterIn,
): Record<string, unknown>[] {
  if (schema === undefined) return [];
  const object = z.toJSONSchema(schema) as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  return Object.entries(object.properties ?? {}).map(([name, property]) => ({
    name,
    in: where,
    required:
      where === ParameterIn.enum.path || object.required?.includes(name),
    schema: property,
  }));
}

function responses(c: AnyContract): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (c.event !== undefined) {
    out[OK_STATUS] = {
      description: 'stream',
      content: { [SSE_CONTENT]: { schema: z.toJSONSchema(c.event) } },
    };
  } else if (c.response !== undefined) {
    out[OK_STATUS] = {
      description: 'ok',
      content: { [JSON_CONTENT]: { schema: z.toJSONSchema(c.response) } },
    };
  }
  if (c.redirect !== undefined) {
    out[c.redirect] = { description: 'redirect' };
  }
  for (const type of c.errors) {
    out[STATUS[type]] = {
      description: type,
      content: { [JSON_CONTENT]: { schema: envelope(type) } },
    };
  }
  return out;
}

function operation(c: AnyContract): Record<string, unknown> {
  return {
    operationId: c.operationId,
    summary: c.summary,
    tags: [c.tag],
    ...(c.deprecated === undefined ? {} : { deprecated: true }),
    security:
      c.public === true
        ? []
        : [
            { [SecurityScheme.enum.bearer]: [] },
            { [SecurityScheme.enum.sessionCookie]: [] },
          ],
    parameters: [
      ...parameters(c.params, ParameterIn.enum.path),
      ...parameters(c.query, ParameterIn.enum.query),
    ],
    ...(c.body === undefined
      ? {}
      : {
          requestBody: {
            required: true,
            content: {
              [JSON_CONTENT]: { schema: z.toJSONSchema(c.body) },
            },
          },
        }),
    responses: responses(c),
  };
}

/** `/orgs/:org` becomes `/orgs/{org}`. */
function documentPath(path: string): string {
  return path.replaceAll(/:(\w+)/gu, '{$1}');
}

/** D4: the document, built from the contracts on each call. */
export function openApiDocument(catalog: ContractCatalog): OpenApiDocument {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const c of Object.values(catalog)) {
    const key = documentPath(c.path);
    paths[key] = {
      ...paths[key],
      [c.method.toLowerCase()]: operation(c),
    };
  }
  return {
    openapi: '3.1.0',
    info: { title: 'api', version: 'v1' },
    servers: [{ url: '/api/v1' }],
    components: {
      securitySchemes: {
        [SecurityScheme.enum.bearer]: { type: 'http', scheme: 'bearer' },
        [SecurityScheme.enum.sessionCookie]: {
          type: 'apiKey',
          in: 'cookie',
          name: SESSION_COOKIE,
        },
      },
    },
    paths,
  };
}
